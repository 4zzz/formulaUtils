import { asciiFactory } from './stringify'
import { formulaToClauseTheory } from './CNFTransform';
import { CellContext } from './context';
import { SymbolWithArity, parseFormulaWithPrecedence } from '@fmfi-uk-1-ain-412/js-fol-parser';
import { ASTFactory, reconstructASTClause } from './AST';

function convert(f: string, context: CellContext) {
  let ast = parseFormulaWithPrecedence(f, context, ASTFactory(context));
  let clauses = formulaToClauseTheory(ast, context, () => 0);

  console.log('Result: ');
  for (let c of clauses) {
    console.log('\t',reconstructASTClause(c, asciiFactory()));
  }
}


const context1 = new CellContext({
  constants: ['a', 'b', 'c'],
  functions: [
    {name: 'f', arity: 1},
    {name: 'g', arity: 1}, 
  ],
  predicates: [
    {name: 'P', arity: 1},
    {name: 'Q', arity: 2},
    {name: 'R', arity: 2},
    {name: 'S', arity: 1},
  ]
})

const context2 = new CellContext({
  constants: ['a', 'b', 'c'],
  functions: [
    {name: 'f', arity: 1},
    {name: 'g', arity: 1}, 
  ],
  predicates: [
    {name: 'p', arity: 1},
    {name: 'q', arity: 2},
  ]
});

convert('~(\\e x (\\e y \\a z (\\e w R(x, w) | Q(f(y), z)) -> (P(x) & ~S(x))))', context1);
//convert('\\a u \\a v \\e x \\e y P(f(x), g(y))', context1);
//convert('\\a x a = x', context2)
