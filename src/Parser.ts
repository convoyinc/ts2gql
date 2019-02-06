import * as types from './types';
import { MethodParamsTokenizer, MethodParamsToken, TokenType } from './Tokenizer';

class ParsingFailedException extends Error {}

export class MethodParamsParser  {
    private tokenizer:MethodParamsTokenizer;
    private tokens:MethodParamsToken[];
    private args:Map<string, types.DirectiveInputValueNode>;

    constructor() {
        this.tokenizer = new MethodParamsTokenizer();
        this.tokens = [];
        this.args = {} as Map<string, types.DirectiveInputValueNode>;
    }

    parse(stringToParse:string):types.DirectiveInputValueNode[] {
        this.tokens = this.tokenizer.tokenize(stringToParse);
        this._parseArgs();
        return Array.from(this.args.values());
    }

    _parseArgs():Map<string, types.DirectiveInputValueNode> {
        if (!this.tokens || this.tokens[0].type !== TokenType.PARAMETER_LIST_BEGIN) {
            throw new ParsingFailedException(`Token list created without beginning token.`);
        }
        let argIdx = 1;
        while (this.tokens[argIdx].type !== TokenType.PARAMETER_LIST_END) {
            if (argIdx > 1) {
                if (this.tokens[argIdx].type !== TokenType.PARAMETER_SEPARATOR)
                    throw new ParsingFailedException(`Expected separators between parameters in parameter list.`);
                argIdx++;
            }
            argIdx = this._parseArg(argIdx);
        }

        return this.args;
    }

    _parseArg(start:number):number {
        const nameToken = this.tokens[start];
        const nameValueSeparatorToken = this.tokens[start + 1];
        const valueToken = this.tokens[start + 2];
        if (nameToken.type !== TokenType.PARAMETER_NAME
        || nameValueSeparatorToken.type !== TokenType.PARAMETER_NAME_VALUE_SEPARATOR
        || valueToken.type !== TokenType.PARAMETER_VALUE) {
            throw new ParsingFailedException(`Invalid token sequence for parameter list:
            \n${nameToken.type}: ${nameToken.value}
            \n${nameValueSeparatorToken.type}: ${nameValueSeparatorToken.value}
            \n${valueToken.type}: ${valueToken.value}`);
        }

        if (this.args[nameToken.value]) {
            throw new ParsingFailedException(`Repeated param name ${nameToken.value}.`);
        }
        this.args[nameToken.value] = {
            name: nameToken.value,
            kind: types.GQLDefinitionKind.DIRECTIVE_INPUT_VALUE_DEFINITION,
            value: {
                kind: types.GQLTypeKind.VALUE,
                value: valueToken.value,
            },
        };

        return start + 3;
    }
}
