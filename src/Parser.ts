import * as types from './types';
import { MethodParamsTokenizer, MethodParamsToken, TokenType } from './Tokenizer';

export interface PartialParseResult {
    nextIdx:number;
}

export interface ArgNameParseResult extends PartialParseResult {
    argName:string;
}

export interface ArgValueParseResult extends PartialParseResult {
    argValue:types.ValueNode;
}

export class ParsingFailedException extends Error {}

export class MethodParamsParser  {
    private tokenizer:MethodParamsTokenizer;
    private tokens:MethodParamsToken[];
    private args:types.TypeDefinitionMap;

    constructor() {
        this.tokenizer = new MethodParamsTokenizer();
        this.tokens = [];
        this.args = {};
    }

    parse(stringToParse:string):types.DirectiveArguments {
        this.tokens = this.tokenizer.tokenize(stringToParse);
        return {
            kind: types.GQLNodeKind.ARGUMENTS_DEFINITION,
            args: this._parseArgs(),
        };
    }

    _parseArgs():types.TypeDefinitionMap {
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
            kind: types.GQLNodeKind.VALUE,
            value: valueToken.value,
        };

        return start + 3;
    }
}
