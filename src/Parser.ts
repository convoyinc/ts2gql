import { ArgValueParseResult } from './Parser';
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

export class InvalidParamsException extends Error {}

export class ParsingFailedException extends Error {}

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
            throw new InvalidParamsException('Mismatching parenthesis at parameter list definition');
        }
        let argStart = 1;
        while (argStart < this.limit && this.token[argStart] !== ')') {
            argStart = this._parseArg(argStart);
        }

        return this.args;
    }

    _parseArg(startIdx:number):number {
        const argNameParseResult = this._parseArgName(startIdx);
        let argValueParseResult;
        try {
            argValueParseResult = this._parseArgValue(argNameParseResult.nextIdx);
        } catch (e) {
            e.message = `${e.message} at parameter ${argNameParseResult.argName}.`;
            throw e;
        }

        if (this.args[argNameParseResult.argName]) {
            throw new InvalidParamsException(`Repeated param name ${argNameParseResult.argName}.`);
        }
        this.args[argNameParseResult.argName] = argValueParseResult.argValue;

        return argValueParseResult.nextIdx;
    }

    _parseArgName(startIdx:number):ArgNameParseResult {
        if (!this._checkIndexBound(startIdx)) {
            throw new ParsingFailedException('Unexpected end of parameter name.');
        }
        if (this.token[startIdx].match(/[^A-Za-z]/)) {
            throw new InvalidParamsException(`Invalid character ${this.token[startIdx]} in parameter name.`);
        }
        let pointer = startIdx + 1;
        while (true) {
            const char = this.token[pointer];
            if (char === ':') break;
            if (char.match(/[^\w]/) || pointer === this.limit) {
                throw new InvalidParamsException('Invalid character ' + char + 
                ' at name ' + this.token.slice(startIdx, pointer) + '.');
            }
            pointer++;
        }
        
        return {
            argName: this.token.slice(startIdx, pointer),
            nextIdx: pointer + 1,
        };
    }

    _parseArgValue(startIdx:number):ArgValueParseResult {
        if (!this._checkIndexBound(startIdx)) {
            throw new ParsingFailedException('Unexpected end of parameter value');
        }

        const stringLiteralDelimiters = ['\'', '"'];
        const literalIdx = _.findIndex(stringLiteralDelimiters, (delimiter) => delimiter === this.token[startIdx]);

        let commaIdx;
        if (literalIdx !== -1) {
            // We have a string literal, let's search for value end only after its definition end
            const delimiter = stringLiteralDelimiters[literalIdx];
            const literalEndIdx = this.token.indexOf(delimiter, startIdx + 1);
            if (literalEndIdx === startIdx) {
                throw new InvalidParamsException(`Mismatched ${delimiter} delimiter in string literal`);
            }

            commaIdx = this.token.indexOf(',', literalEndIdx + 1);
        } else {
            commaIdx = this.token.indexOf(',', startIdx);
        }
        
        // If there's no comma, it's last value
        const endIdx = commaIdx !== -1 ? commaIdx : this.limit - 1;

        return {
            argValue: {
                type: types.NodeType.VALUE,
                value: this.token.slice(startIdx, endIdx),
            },
            nextIdx: endIdx + 1,
        };
    }

    _checkIndexBound(idx:number):boolean {
        return idx >= 0 && idx < this.limit;
    }

}
