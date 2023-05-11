import { Language, SymbolWithArity } from "@fmfi-uk-1-ain-412/js-fol-parser";

export interface NamedFormula {
  name: string,
  formula: string,
}

export interface Theorem extends NamedFormula {
  prooved: boolean,
}

export interface LogicContext {
  constants: Array<string>,
  predicates: Array<SymbolWithArity>,
  functions: Array<SymbolWithArity>,

  formulas: Array<NamedFormula>,
  axioms: Array<NamedFormula>,
  theorems: Array<Theorem>,
}

export class CellContext implements LogicContext {
  private context: LogicContext
  private symbolsLUT: Map<string, { arity: number, index: number, type: 'constant' | 'function' | 'predicate' | 'axiom' | 'formula' | 'theorem' }>

  public get constants() { return this.context.constants }
  public get predicates() { return this.context.predicates }
  public get functions() { return this.context.functions }
  public get formulas() { return this.context.formulas }
  public get axioms() { return this.context.axioms }
  public get theorems() { return this.context.theorems }

  public get constantsExpr() { return this.context.constants.join(', ') }
  public get predicatesExpr() { return this.context.predicates.map(s => `${s.name}/${s.arity}`).join(', ') }
  public get functionsExpr() { return this.context.functions.map(s => `${s.name}/${s.arity}`).join(', ') }

  constructor(context: Partial<LogicContext>) {
    this.context = {
      constants: context.constants || [],
      functions: context.functions || [],
      predicates: context.predicates || [],
      theorems: context.theorems || [],
      axioms: context.axioms || [],
      formulas: context.formulas || [],
    }
    this.symbolsLUT = new Map();
    this.context.constants.forEach((s, index) => this.symbolsLUT.set(s, { arity: 0, type: 'constant', index }))
    this.context.predicates.forEach((s, index) => this.symbolsLUT.set(s.name, { arity: s.arity, type: 'predicate', index }))
    this.context.functions.forEach((s, index) => this.symbolsLUT.set(s.name, { arity: s.arity, type: 'function', index }))
    this.context.axioms.forEach((s, index) => this.symbolsLUT.set(s.name, { arity: 0, type: 'axiom', index }))
    this.context.formulas.forEach((s, index) => this.symbolsLUT.set(s.name, { arity: 0, type: 'formula', index }))
    this.context.theorems.forEach((s, index) => this.symbolsLUT.set(s.name, { arity: 0, type: 'theorem', index }))
  }
  logicContext() {
    return this.context;
  }
  isConstant(symbol: string) {
    return this.symbolsLUT.get(symbol)?.type === 'constant'
  }
  isPredicate(symbol: string) {
    return this.symbolsLUT.get(symbol)?.type === 'predicate'
  }
  isFunction(symbol: string) {
    return this.symbolsLUT.get(symbol)?.type === 'function'
  }
  isVariable(_: string) {
    return true;
  }
  symbolExits(symbol: string) {
    //console.log('symbols exists ? ', symbol, this.symbolsLUT.has(symbol));
    return this.symbolsLUT.has(symbol);
  }
  symbolArity(symbol: string) {
    return this.symbolsLUT.get(symbol)?.arity
  }
  getFormula(name: string) {
    const s = this.symbolsLUT.get(name);
    switch (s?.type) {
      case 'axiom':
        return {
          type: 'axiom',
          name,
          formula: this.axioms[s.index].formula
        }
      case 'theorem':
        return {
          type: 'theorem',
          name,
          formula: this.theorems[s.index].formula
        }
      case 'formula':
        return {
          type: 'formula',
          name,
          formula: this.formulas[s.index].formula
        }
      default:
        return undefined;
    }
  }
}
