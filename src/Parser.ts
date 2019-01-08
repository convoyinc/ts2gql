import * as types from './types';
import * as _ from 'lodash';

export interface PartialParseResult {
    nextIdx:number;
}

export interface ArgNameParseResult extends PartialParseResult {
    argName:string;
}

export interface ArgValueParseResult extends PartialParseResult {
    argValue:types.ValueNode;
}

export class InvalidParamsException extends Error {
    constructor() {
        super("Invalid parameter list.");
    }
}

export class MethodParamsParser  {
    public token:string;
    private limit:number;
    private args:types.TypeMap;

    constructor(token:string) {
        this.token = token;
        this.limit = token.length;
        this.args = {};
    }

    parse():types.MethodParamsNode {
        return {
            type: types.NodeType.METHOD_PARAMS,
            args: this._parseArgs(),
        };
    }

    _parseArgs():types.TypeMap {
        if (!this.token || this.token[0] !== '(' || this.token[this.limit - 1] !== ')') {
            throw new InvalidParamsException();
        }
        let argStart = 1;
        while (argStart < this.limit && this.token[argStart] !== ')') {
            argStart = this._parseArg(argStart);
        }

        return this.args;
    }

    _parseArg(startIdx:number):number {
        const argNameParseResult = this._parseArgName(startIdx);
        const argValueParseResult = this._parseArgValue(argNameParseResult.nextIdx);

        if (this.args[argNameParseResult.argName]) {
            throw new InvalidParamsException();
        }
        this.args[argNameParseResult.argName] = argValueParseResult.argValue;

        return argValueParseResult.nextIdx;
    }

    _parseArgName(startIdx:number):ArgNameParseResult {
        if (this.token[startIdx].match(/[^A-Za-z]/) || !this._checkIndex(startIdx)) {
            throw new InvalidParamsException();
        }
        let pointer = startIdx + 1;
        while (true) {
            if (this.token[pointer] === ':') break;
            if (this.token[pointer].match(/[^\w]/) || pointer === this.limit) {
                throw new InvalidParamsException();
            }
            pointer++;
        }
        
        return {
            argName: this.token.slice(startIdx, pointer),
            nextIdx: pointer + 1,
        };
    }

    _parseArgValue(startIdx:number):ArgValueParseResult {
        if (!this._checkIndex(startIdx)) {
            throw new InvalidParamsException();
        }

        const stringLiteralDelimiters = ['\'', '"'];
        const literalIdx = _.findIndex(stringLiteralDelimiters, (delimiter) => delimiter === this.token[startIdx]);

        let commaIdx;
        let endIdx;
        if (literalIdx !== -1) {
            // We have a string literal, let's search for value end only after its definition end
            const delimiter = stringLiteralDelimiters[literalIdx];
            const literalEndIdx = this.token.indexOf(delimiter, startIdx + 1);
            if (literalEndIdx === startIdx) {
                throw new InvalidParamsException();
            }

            commaIdx = this.token.indexOf(',', literalEndIdx + 1);
        } else {
            commaIdx = this.token.indexOf(',', startIdx);
        }
        
        // If there's no comma, it's last value
        endIdx = commaIdx !== -1 ? commaIdx : this.limit - 1;

        return {
            argValue: {
                type: types.NodeType.VALUE,
                value: this.token.slice(startIdx, endIdx),
            },
            nextIdx: endIdx + 1,
        };
    }

    _checkIndex(idx:number):boolean {
        return idx >= 0 && idx < this.limit;
    }

}
