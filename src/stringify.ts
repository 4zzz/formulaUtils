import { ClauseFactories, ErrorExpected, FormulaFactories } from "@fmfi-uk-1-ain-412/js-fol-parser";
import { CellContext } from "./context";

export const texFactory = (context?: CellContext) => {
  const testArity = (symbol: string, args: any[], ee: ErrorExpected) => {
    if (context) {
      const a = context.symbolArity(symbol)
      a !== args.length && ee.expected(`${a} arguments for ${symbol}`);
    }
  }
  const factory: FormulaFactories<string, string> & ClauseFactories<string, string, string> = {
    variable: (symbol) => symbol.replaceAll('_', '\\_'),
    constant: (symbol) => `\\text{\\textsf{${symbol.replaceAll('_', '\\_')}}}`,
    literal(negated, symbol, args, ee) {
      const atom = this.predicateAtom(symbol, args, ee);
      return negated ? this.negation(atom, ee) : atom;
    },
    clause(literals) { return literals.join(' \\lor ') },
    equalityAtom: (lhs, rhs) => `${lhs} \\doteq ${rhs}`,
    negation: (subf) => `\\neg ${subf}`,
    conjunction: (lhs, rhs) => `(${lhs} \\land ${rhs})`,
    disjunction: (lhs, rhs) => `(${lhs} \\lor ${rhs})`,
    implication: (lhs, rhs) => `(${lhs} \\rarr ${rhs})`,
    equivalence: (lhs, rhs) => `(${lhs} \\lrarr ${rhs})`,
    existentialQuant: (variable, subf) => `\\exists ${variable} \\text{ } ${subf}`,
    universalQuant: (variable, subf) => `\\forall ${variable} \\text{ } ${subf}`,
    functionApplication: (symbol, args, ee) => {
      testArity(symbol, args, ee);
      return `\\text{\\textsf{${symbol.replaceAll('_', '\\_')}}}(${args.map(a => `${a}`).join(', ')})`
    },
    predicateAtom: (symbol, args, ee) => {
      testArity(symbol, args, ee);
      return `\\text{\\textsf{${symbol.replaceAll('_', '\\_')}}}(${args.join(', ')})`
    },
  };
  return factory;
}

export const unicodeFactory = (context?: CellContext) => {
  const testArity = (symbol: string, args: any[], ee: ErrorExpected) => {
    if (context) {
      const a = context.symbolArity(symbol)
      a !== args.length && ee.expected(`${a} arguments for ${symbol}`);
    }
  }
  const factory: FormulaFactories<string, string> & ClauseFactories<string, string, string> = {
    variable: (symbol) => symbol,
    constant: (symbol) => symbol,
    literal(negated, symbol, args, ee) {
      const atom = this.predicateAtom(symbol, args, ee);
      return negated ? this.negation(atom, ee) : atom;
    },
    clause(literals) { return literals.join(' ∨ ') },
    equalityAtom: (lhs, rhs) => `${lhs} ≐ ${rhs}`,
    negation: (subf) => `¬${subf}`,
    conjunction: (lhs, rhs) => `(${lhs} ∧ ${rhs})`,
    disjunction: (lhs, rhs) => `(${lhs} ∨ ${rhs})`,
    implication: (lhs, rhs) => `(${lhs} → ${rhs})`,
    equivalence: (lhs, rhs) => `(${lhs} ↔ ${rhs})`,
    existentialQuant: (variable, subf) => `∃ ${variable} ${subf}`,
    universalQuant: (variable, subf) => `∀ ${variable} ${subf}`,
    functionApplication: (symbol, args, ee) => {
      testArity(symbol, args, ee);
      return `${symbol}(${args.join(', ')})`
    },
    predicateAtom: (symbol, args, ee) => {
      testArity(symbol, args, ee);
      return `${symbol}(${args.join(', ')})`
    },
  };
  return factory;
}

export const asciiFactory = (context?: CellContext) => {
  const testArity = (symbol: string, args: any[], ee: ErrorExpected) => {
    if (context) {
      const a = context.symbolArity(symbol)
      a !== args.length && ee.expected(`${a} arguments for ${symbol}`);
    }
  }
  const factory: FormulaFactories<string, string> & ClauseFactories<string, string, string> = {
    variable: (symbol) => symbol,
    constant: (symbol) => symbol,
    literal(negated, symbol, args, ee) {
      let atom: string;
      if (symbol === '=') {
        atom = this.equalityAtom(args[0], args[1]);
      } else {
        atom = this.predicateAtom(symbol, args, ee);
      }
      return negated ? this.negation(atom, ee) : atom;
    },
    clause(literals) { return literals.join(' | ') },
    equalityAtom: (lhs, rhs) => `${lhs} = ${rhs}`,
    negation: (subf) => `~${subf}`,
    conjunction: (lhs, rhs) => `(${lhs} & ${rhs})`,
    disjunction: (lhs, rhs) => `(${lhs} | ${rhs})`,
    implication: (lhs, rhs) => `(${lhs} -> ${rhs})`,
    equivalence: (lhs, rhs) => `(${lhs} <-> ${rhs})`,
    existentialQuant: (variable, subf) => `\\e ${variable} ${subf}`,
    universalQuant: (variable, subf) => `\\a ${variable} ${subf}`,
    functionApplication: (symbol, args, ee) => {
      testArity(symbol, args, ee);
      return `${symbol}(${args.join(', ')})`
    },
    predicateAtom: (symbol, args, ee) => {
      testArity(symbol, args, ee);
      return `${symbol}(${args.join(', ')})`
    },
  };
  return factory;
}