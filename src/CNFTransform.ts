import { SymbolWithArity } from "@fmfi-uk-1-ain-412/js-fol-parser";
import { CellContext } from "./context";
import {
  Constant, Variable, FunctionApplication, Term,
  PredicateAtom,
  Negation, NegationExt,
  Conjunction, Disjunction,
  Implication, Equivalence,
  ExistentialQuant, UniversalQuant, reconstructASTFormula, EqualityAtom, Clause
} from "./AST";
import { TreeNode, Transformer } from './AST'
import { asciiFactory } from "./stringify";

export const replaceImplication = (n: TreeNode): Exclude<TreeNode, Implication> => {
  return n.t === 'implication' ?
    new Disjunction(
      new Negation(n.lhs),
      n.rhs
    ) : n;
}
export const replaceEquivalence = (n: TreeNode): Exclude<TreeNode, Equivalence> => {
  return n.t === 'equivalence' ?
    new Conjunction(
      new Implication(n.lhs, n.rhs),
      new Implication(n.rhs, n.lhs),
    ) : n;
}
export function collectUsedVariables(usedVariables: Set<string>): Transformer<TreeNode, TreeNode> {
  return {
    enter(n: TreeNode) {
      if (n.t === 'predicateAtom') {
        const collectFromArgs = (args: Term[]) => {
          for (let a of args) {
            if (a.t === 'variable') {
              usedVariables.add(a.symbol)
            } else if (a.t === 'functionApplication') {
              collectFromArgs(a.args);
            }
          }
        }
        collectFromArgs(n.args);
      } else if (n.t === 'existentialQuant' || n.t === 'universalQuant') {
        usedVariables.add(n.variable);
      }
    }
  }
}
export function uniqueVars(usedVariables: Set<string>, context: CellContext) {
  return {
    name: 'uniqueVars',
    varInfo: new Map<string, { usage: number, renameStack: string[] }>(),
    newVarName(name: string, updateStack: boolean) {
      let { usage, renameStack } = (this.varInfo.get(name) || { usage: 0, renameStack: [name] });

      const genName = (name: string, usage: number) => {
        return usage === 0 ? name : `${name}${usage}`;
      }

      let newName = genName(name, usage);
      usage += 1;
      // when usage === 1, no rename was performed, so no need to check for conflicts 
      while (usage > 1 && (usedVariables.has(newName) || context.symbolExits(newName))) {
        newName = genName(name, usage);
        usage += 1;
      }
      if (updateStack) {
        renameStack.push(newName);
      }
      this.varInfo.set(name, { usage, renameStack })
      return newName;
    },
    renameQVar(name: string) {
      return this.newVarName(name, true);
    },
    renameVar(name: string) {
      const info = this.varInfo.get(name);
      if (!info || info.renameStack.length === 1) {
        // free variable
        return this.newVarName(name, false);
      } else {
        // bound variable
        return info.renameStack[info.renameStack.length - 1];
      }
    },
    leave(oldNode: TreeNode) {
      if (oldNode.t === 'universalQuant' || oldNode.t === 'existentialQuant') {
        this.varInfo.get(oldNode.variable)!.renameStack.pop();
      }
    },
    transform(node: TreeNode) {
      if (node.t === 'universalQuant' || node.t === 'existentialQuant') {
        // rename in quantifiers node
        return node.t === 'universalQuant' ?
          new UniversalQuant(this.renameQVar(node.variable), node.subf)
          : new ExistentialQuant(this.renameQVar(node.variable), node.subf);
      } else if (node.t === 'predicateAtom') {
        // rename in terms
        return node.argsApply(term => {
          if (term.t === 'variable') {
            return new Variable(this.renameVar(term.symbol));
          }
          return term;
        });
      } else {
        return node;
      }
    }
  }
};
export function skolemization(context: CellContext, addSymbol: (symbol: string | SymbolWithArity) => void) {
  let skolemCounter = 0;
  return {
    name: 'skolemization',
    uqVarsStack: new Array<string>(),
    replacing: new Map<string, Term>(),
    unusedName(name: string) {
      let newName = name;
      let index = 1;
      while (context.symbolExits(newName)) {
        newName = `${name}${index++}`;
      }
      return newName;
    },
    enter(n: TreeNode) {
      //console.log('enter ', n.t)
      if (n.t === 'universalQuant') {
        this.uqVarsStack.push(n.variable)
        //console.log('adding to stack ', n.variable);
      }
    },
    leave(oldNode: TreeNode, newNode: TreeNode) {
      //console.log('leave ', n.t)
      if (newNode.t === 'universalQuant') {
        //console.log('removing from stack ', this.uqVarsStack.pop())
        this.uqVarsStack.pop()
      }
    },
    transform(n: TreeNode): Exclude<TreeNode, ExistentialQuant> {

      const transformPredicate = (n: PredicateAtom): PredicateAtom => {
        return n.argsApply((term: Term) => {
          if (term.t === 'variable' && this.replacing.has(term.symbol)) {
            return this.replacing.get(term.symbol)!
          }
          return term;
        })
      }
      const transformExists = (n: ExistentialQuant): Exclude<TreeNode, ExistentialQuant> => {
        if (this.uqVarsStack.length === 0) {
          const skolemConstant = new Constant(this.unusedName(`concrete_${n.variable}`))
          addSymbol(skolemConstant.symbol);
          this.replacing.set(n.variable, skolemConstant);
        } else {
          const skolemFunction = new FunctionApplication(
            this.unusedName(`skolemf${(skolemCounter) === 0 ? '' : skolemCounter}`),
            this.uqVarsStack.map(s => new Variable(s))
          );
          ++skolemCounter;
          addSymbol({name: skolemFunction.symbol, arity: skolemFunction.args.length});
          this.replacing.set(n.variable, skolemFunction);
        }
        if (n.subf.t === 'existentialQuant') {
          return transformExists(n.subf);
        } else if (n.subf.t === 'predicateAtom') {
          return transformPredicate(n.subf)
        } else if (n.subf.t === 'universalQuant') {
          this.uqVarsStack.push(n.subf.variable)
        }
        return n.subf;
      }

      if (n.t === 'existentialQuant') {
        return transformExists(n);
      } else if (n.t === 'predicateAtom') {
        return transformPredicate(n);
      }
      return n;
    }
  }
}
export function NNF(n: TreeNode) {
  const simplifyNegation = (n: Negation) => {
    let v = false;
    let trimmed = false;
    let subf = n.subf
    while (subf.t === 'negation') {
      v = !v;
      subf = subf.subf;
      trimmed = true;
    }
    if (trimmed) {
      return v ? subf : new Negation(subf);
    }
    return n;
  }
  if (n.t === 'negation') {
    n = simplifyNegation(n);
  }
  if (n.t === 'negation') {
    if (n.subf.t === 'conjunction') {
      return new Disjunction(
        simplifyNegation(new Negation(n.subf.lhs)),
        simplifyNegation(new Negation(n.subf.rhs))
      )
    }
    if (n.subf.t === 'disjunction') {
      return new Conjunction(
        simplifyNegation(new Negation(n.subf.lhs)),
        simplifyNegation(new Negation(n.subf.rhs))
      )
    }
    if (n.subf.t === 'existentialQuant') {
      return new UniversalQuant(
        n.subf.variable,
        simplifyNegation(new Negation(n.subf.subf)),
      )
    }
    if (n.subf.t === 'universalQuant') {
      return new ExistentialQuant(
        n.subf.variable,
        simplifyNegation(new Negation(n.subf.subf)),
      )
    }
  }
  return n;
}
export function PNF(n: TreeNode) {
  if (n.t === 'conjunction') {
    if (n.lhs.t === 'universalQuant') {
      return new UniversalQuant(
        n.lhs.variable,
        new Conjunction(
          n.lhs.subf,
          n.rhs
        )
      )
    }
    if (n.rhs.t === 'universalQuant') {
      return new UniversalQuant(
        n.rhs.variable,
        new Conjunction(
          n.lhs,
          n.rhs.subf
        )
      )
    }
  }
  if (n.t === 'disjunction') {
    if (n.lhs.t === 'universalQuant') {
      return new UniversalQuant(
        n.lhs.variable,
        new Disjunction(
          n.lhs.subf,
          n.rhs
        )
      )
    }
    if (n.rhs.t === 'universalQuant') {
      return new UniversalQuant(
        n.rhs.variable,
        new Disjunction(
          n.lhs,
          n.rhs.subf
        )
      )
    }
  }
  return n;
}

export function CNF(n: TreeNode) {
  const distribute = (subf: TreeNode, con: Conjunction, swap: boolean = false) => {
    return new Conjunction(
      swap ? new Disjunction(con.lhs, subf) : new Disjunction(subf, con.lhs),
      swap ? new Disjunction(con.rhs, subf) : new Disjunction(subf, con.rhs)
    )
  }
  if (n.t === 'disjunction' && n.rhs.t === 'conjunction') {
    return distribute(n.lhs, n.rhs);
  }
  if (n.t === 'disjunction' && n.lhs.t === 'conjunction') {
    return distribute(n.rhs, n.lhs, true);
  }
  return n;
}

export function collectClauses(clauses: Clause[]) {
  let opStack: Extract<TreeNode['t'], 'conjunction' | 'disjunction' | 'negation'>[] = [];
  let clause: Clause = [];
  return {
    enter(n: TreeNode) {
      if (n.t === 'conjunction' || n.t === 'disjunction' || n.t === 'negation') {
        opStack.push(n.t);
      } else if (n.t === 'predicateAtom' || n.t === 'equalityAtom') {
        if (opStack.length > 0 && opStack[opStack.length - 1] === 'negation') {
          clause.push(new Negation(n));
        } else {
          clause.push(n);
        }
      }
    },
    leave(n: TreeNode) {
      if (n.t === 'conjunction' || n.t === 'disjunction' || n.t === 'negation') {
        opStack.pop();
      }
      if (opStack.length === 0 && clause.length > 0) {
        clauses.push(clause);
        clause = [];
      } else if (opStack.length > 0 && opStack[opStack.length - 1] === 'conjunction' && clause.length > 0) {
        clauses.push(clause);
        clause = [];
      }
    }
  }
}

export function formulaToCNF(formula: TreeNode, language: CellContext, addSymbol: (symbol: string | SymbolWithArity) => void) {
  const watchMods = (f: (n: TreeNode) => TreeNode, onModified: () => void) => {
    return (n1: TreeNode) => {
      const newN = f(n1);
      if (newN !== n1) {
        onModified()
      }
      return newN;
    }
  }
  const apply = (n: TreeNode, trs: Transformer<TreeNode, TreeNode>[]) => {
    let nn = n;
    let i = 0;
    for (let t of trs) {
      // @ts-ignore
      console.log(t.name);
      console.log('before: ', reconstructASTFormula(nn, asciiFactory()))
      nn = nn.apply(t);
      console.log('after:  ', reconstructASTFormula(nn, asciiFactory()))
    }
    return nn;
  }

  const usedVariables = new Set<string>();
  formula.apply(collectUsedVariables(usedVariables));
  let t = apply(formula,
    [
      replaceEquivalence,
      replaceImplication,
      NNF,
      uniqueVars(usedVariables, language),
      skolemization(language, addSymbol),
    ]
  );
  let modified = false;
  do {
    modified = false;
    t = t.apply(watchMods(
      PNF,
      () => modified = true)
    );
  } while ((modified as boolean) === true);
  do {
    modified = false;
    t = t.apply(
      watchMods(CNF,
        () => modified = true)
    );
  } while ((modified as boolean) === true);
  return t;
}

export function formulaToClauseTheory(ast: TreeNode, context: CellContext, addSymbol: (symbol: string | SymbolWithArity) => void) {
  let clauses: Clause[] = [];
  formulaToCNF(ast, context, addSymbol).apply(collectClauses(clauses));
  return clauses;
} 
