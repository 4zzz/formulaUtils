import { ClauseFactories, ErrorExpected, FormulaFactories, parseFormulaWithPrecedence } from "@fmfi-uk-1-ain-412/js-fol-parser";
import { CellContext } from "./context";
import { asciiFactory } from "./stringify";

abstract class NodeBase<T> {
  readonly t: T;
  children: TreeNode[];
  constructor(t: T, children: TreeNode[]) {
    this.t = t; this.children = children;
  }
}
abstract class BinOpNode<T, LT extends TreeNode, RT extends TreeNode> extends NodeBase<T> {
  constructor(t: T, lhs: LT, rhs: RT) {
    super(t, [lhs, rhs]);
  }
  get lhs() { return this.children[0] as LT }
  get rhs() { return this.children[1] as RT }
}
abstract class UnOpNode<T, ST extends TreeNode> extends NodeBase<T> {
  constructor(t: T, subf: ST) {
    super(t, [subf]);
  }
  get subf() { return this.children[0] }
}
export type Transformer<I extends TreeNode, O extends TreeNode> = {
  enter?: (t: I) => void,
  leave?: (oldNode: I, newNode: O) => void,
  transform?: (n: I) => O | ['stop', O]
  transformLeave?: (n: I | O) => O
} | ((n: I) => O | ['stop', O]);

function apply<I extends TreeNode, O extends TreeNode>(this: I, t: Transformer<I, O>) {
  const enter = typeof t === 'object' ? t.enter : undefined;
  const transformEnter = typeof t === 'function' ? t : (t.transform || ((n: O) => n));
  const transformLeave = typeof t === 'function' ? undefined : t.transformLeave;
  const leave = typeof t === 'object' ? t.leave : undefined;
  enter && enter.call(t, this);
  let newNode = transformEnter ? transformEnter.call(t, this) : this;
  let stop = false;
  // if transformer returns ['stop', node: O] it wants to stop applying further 
  if (Array.isArray(newNode)) {
    newNode = newNode[1];
    stop = true;
  }
  let modified = false;
  if (!stop) {
    const newChildren = newNode.children.map(c => {
      const newC = c.apply(t);
      if (c !== newC) {
        modified = true;
      }
      return newC;
    });
    if (modified) {
      // construction tree is not immutable
      newNode.children = newChildren;
    }
  }
  // leave transformation
  newNode = transformLeave ? transformLeave.call(t, newNode) : newNode;
  leave && leave.call(t, this, newNode);
  return newNode;
}

export class ConjunctionExt<LT extends TreeNode, RT extends TreeNode> extends BinOpNode<'conjunction', LT, RT> {
  constructor(lhs: LT, rhs: RT) {
    super('conjunction', lhs, rhs);
  }
  apply = apply
}
export class DisjunctionExt<LT extends TreeNode, RT extends TreeNode> extends BinOpNode<'disjunction', LT, RT> {
  constructor(lhs: LT, rhs: RT) {
    super('disjunction', lhs, rhs);
  }
  apply = apply
}
export class ImplicationExt<LT extends TreeNode, RT extends TreeNode> extends BinOpNode<'implication', LT, RT> {
  constructor(lhs: LT, rhs: RT) {
    super('implication', lhs, rhs);
  }
  apply = apply
}
export class EquivalenceExt<LT extends TreeNode, RT extends TreeNode> extends BinOpNode<'equivalence', LT, RT> {
  constructor(lhs: LT, rhs: RT) {
    super('equivalence', lhs, rhs);
  }
  apply = apply
}
export class NegationExt<ST extends TreeNode> extends UnOpNode<'negation', ST> {
  constructor(subf: ST) {
    super('negation', subf);
  }
  apply = apply
}
export class EqualityAtom extends NodeBase<'equalityAtom'> {
  lhs: Term; rhs: Term;
  constructor(lhs: Term, rhs: Term) {
    super('equalityAtom', []);
    this.lhs = lhs; this.rhs = rhs;
  }
  apply = apply
}
export class PredicateAtom extends NodeBase<'predicateAtom'> {
  symbol: string; args: Term[]
  constructor(symbol: string, args: Term[]) {
    super('predicateAtom', []);
    this.symbol = symbol; this.args = args;
  }
  apply = apply
  argsApply(f: (t: Term) => Term) {
    let modified = false;
    const newArgs = this.args.map(a => {
      const newA = a.apply(f)
      if (a !== newA) {
        modified = true;
      }
      return newA;
    })
    if (modified) {
      return new PredicateAtom(this.symbol, newArgs);
    }
    return this;
  }
}
export class ExistentialQuantExt<ST extends TreeNode> extends UnOpNode<'existentialQuant', ST> {
  variable: string;
  constructor(variable: string, subf: ST) {
    super('existentialQuant', subf);
    this.variable = variable;
  }
  apply = apply
}
export class UniversalQuantExt<ST extends TreeNode> extends UnOpNode<'universalQuant', ST> {
  variable: string;
  constructor(variable: string, subf: ST) {
    super('universalQuant', subf);
    this.variable = variable;
  }
  apply = apply
}
function termApply(this: Term, f: (t: Term) => Term): Term {
  const newTerm = f(this);
  if (newTerm.t === 'functionApplication') {
    let modified = false;
    const newArgs = newTerm.args.map(a => {
      const newA = a.apply(f);
      if (a !== newA) {
        modified = true;
      }
      return newA;
    });
    if (modified) {
      return new FunctionApplication(newTerm.symbol, newArgs);
    }
  }
  return newTerm;
}
export class Variable {
  t: 'variable' = 'variable'
  symbol: string;
  constructor(symbol: string) {
    this.symbol = symbol
  }
  apply = termApply;
}
export class Constant {
  t: 'constant' = 'constant'
  symbol: string;
  constructor(symbol: string) {
    this.symbol = symbol
  }
  apply = termApply;
}
export class FunctionApplication {
  t: 'functionApplication' = 'functionApplication'
  symbol: string; args: Term[];
  constructor(symbol: string, args: Term[]) {
    this.symbol = symbol; this.args = args;
  }
  apply = termApply;
}

// Theese are just to create shorter contructors for general formulas with any subformula types
export class Conjunction extends ConjunctionExt<TreeNode, TreeNode> { };
export class Disjunction extends DisjunctionExt<TreeNode, TreeNode> { };
export class Implication extends ImplicationExt<TreeNode, TreeNode> { };
export class Equivalence extends EquivalenceExt<TreeNode, TreeNode> { };
export class Negation extends NegationExt<TreeNode> { };
export class ExistentialQuant extends ExistentialQuantExt<TreeNode> { };
export class UniversalQuant extends UniversalQuantExt<TreeNode> { };

export type Term = FunctionApplication | Constant | Variable
export type TreeNode = PredicateAtom | EqualityAtom |
  Negation | Conjunction | Disjunction | Implication | Equivalence | ExistentialQuant | UniversalQuant

export function ASTFactory(context: CellContext): FormulaFactories<Term, TreeNode> {
  const sf = asciiFactory(context);
  return {
    variable: (symbol: string, ee: ErrorExpected) => new Variable(symbol),
    constant: (symbol: string, ee: ErrorExpected) => new Constant(symbol),
    functionApplication: (symbol: string, args: Term[]) => new FunctionApplication(symbol, args),
    predicateAtom(symbol: string, args: Term[], ee: ErrorExpected) {
      return new PredicateAtom(symbol, args)
    },
    equalityAtom(lhs: Term, rhs: Term, ee: ErrorExpected) {
      return new EqualityAtom(lhs, rhs)
    },
    negation(subf: TreeNode, ee: ErrorExpected) {
      return new Negation(subf)
    },
    conjunction(lhs: TreeNode, rhs: TreeNode, ee: ErrorExpected) {
      return new Conjunction(lhs, rhs)
    },
    disjunction(lhs: TreeNode, rhs: TreeNode, ee: ErrorExpected) {
      return new Disjunction(lhs, rhs)
    },
    implication(lhs: TreeNode, rhs: TreeNode, ee: ErrorExpected) {
      return new Implication(lhs, rhs)
    },
    equivalence(lhs: TreeNode, rhs: TreeNode, ee: ErrorExpected) {
      return new Equivalence(lhs, rhs)
    },
    existentialQuant(variable: string, subf: TreeNode, ee: ErrorExpected) {
      return new ExistentialQuant(variable, subf)
    },
    universalQuant(variable: string, subf: TreeNode, ee: ErrorExpected) {
      return new UniversalQuant(variable, subf)
    }
  }
}
export function createFormulaAST(formula: string, context: CellContext) {
  return parseFormulaWithPrecedence(formula, context, ASTFactory(context))
}

export type Clause = (EqualityAtom | PredicateAtom | NegationExt<PredicateAtom> | NegationExt<EqualityAtom>)[]

const rTerm = <T, F, L, C>(term: Term, f: FormulaFactories<T, F> | ClauseFactories<T, L, C>, ee: ErrorExpected): T => {
  switch (term.t) {
    case 'constant':
      return f.constant(term.symbol, ee);
    case 'functionApplication':
      return f.functionApplication(term.symbol, term.args.map(a => rTerm(a, f, ee)), ee);
    case 'variable':
      return f.variable(term.symbol, ee);
  }
}

export function reconstructASTFormula(ast: TreeNode, f: FormulaFactories<any, any>) {
  const ee: ErrorExpected = {
    error(message) {
      throw Error('Error: ' + message);
    },
    expected(expectation) {
      throw Error('Expected: ' + expectation);
    }
  };
  const rNode = <T, F>(node: TreeNode, f: FormulaFactories<T, F>, ee: ErrorExpected): F => {
    const r = (node: TreeNode) => rNode(node, f, ee);
    switch (node.t) {
      case 'conjunction':
        return f.conjunction(r(node.lhs), r(node.rhs), ee);
      case 'disjunction':
        return f.disjunction(r(node.lhs), r(node.rhs), ee);
      case 'implication':
        return f.implication(r(node.lhs), r(node.rhs), ee);
      case 'equivalence':
        return f.equivalence(r(node.lhs), r(node.rhs), ee);
      case 'equalityAtom':
        return f.equalityAtom(rTerm(node.lhs, f, ee), rTerm(node.rhs, f, ee), ee);
      case 'existentialQuant':
        return f.existentialQuant(node.variable, r(node.subf), ee);
      case 'negation':
        return f.negation(r(node.subf), ee);
      case 'predicateAtom':
        return f.predicateAtom(node.symbol, node.args.map(t => rTerm(t, f, ee)), ee);
      case 'universalQuant':
        return f.universalQuant(node.variable, r(node.subf), ee);
    }
  }
  return rNode(ast, f, ee);
}

export function reconstructASTClause(clause: Clause, factory: ClauseFactories<any, any, any>) {
  const ee: ErrorExpected = {
    error(message) {
      throw Error('Error: ' + message);
    },
    expected(expectation) {
      throw Error('Expected: ' + expectation);
    }
  };

  const createLiteral = (n: PredicateAtom | EqualityAtom, negated: boolean) => {
    if (n.t === 'predicateAtom') {
      return factory.literal(negated, n.symbol, n.args.map(t => rTerm(t, factory, ee)), ee)
    } else if (n.t === 'equalityAtom') {
      return factory.literal(negated, '=', [rTerm(n.lhs, factory, ee), rTerm(n.rhs, factory, ee)], ee)
    }
  }

  return factory.clause(clause.map(c => {
    if (c.t === 'negation') {
      return createLiteral(c.subf as (PredicateAtom | EqualityAtom), true);
    } else {
      return createLiteral(c as (PredicateAtom | EqualityAtom), false);
    }
  }));
}
