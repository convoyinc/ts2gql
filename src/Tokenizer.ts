export enum TokenType {
    PARAMETER_LIST_BEGIN = 'PARAMETER_LIST_BEGIN',
    PARAMETER_NAME = 'PARAMETER_NAME',
    PARAMETER_NAME_VALUE_SEPARATOR = 'PARAMETER_NAME_VALUE_SEPARATOR',
    PARAMETER_VALUE = 'PARAMETER_VALUE',
    PARAMETER_SEPARATOR = 'PARAMETER_SEPARATOR',
    PARAMETER_LIST_END = 'PARAMETER_LIST_END',
}

export class MethodParamsToken {
    public type:TokenType;
    public value:string;

    constructor(type:TokenType, value:string) {
        this.type = type;
        this.value = value;
    }
}

class MethodParamsTokenizerException extends Error {}

export class MethodParamsTokenizer {
    private tokens:MethodParamsToken[];
    private raw:string;

    constructor() {
        this.tokens = [];
        this.raw = '';
    }

    tokenize(content:string):MethodParamsToken[] {
        delete this.tokens;
        this.tokens = [];

        this.raw = content;
        this.begin();

        return this.tokens;
    }

    begin() {
        let idx = 0;
        if ( this.raw[idx] !== '(') {
            throw new MethodParamsTokenizerException("Expected '(' at the beginning of parameter list declaration.");
        }

        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_LIST_BEGIN, this.raw[idx]));
        idx = this._ignore(/\s/, idx + 1);
        while (idx < this.raw.length && this.raw[idx] !== ')') {
            if (this.tokens.length > 1) {
                if (this.raw[idx] !== ',') {
                    const lastToken = this.tokens[this.tokens.length - 1];
                    throw new MethodParamsTokenizerException(`Expected ',' after ${lastToken.value} token.`);
                }
                this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_SEPARATOR, ','));
                idx = this._ignore(/\s/, idx + 1);
            }
            idx = this.parameter(idx);
        }

        if (idx >= this.raw.length) {
            throw new MethodParamsTokenizerException("Expected ')' at the end of parameter list declaration.");
        }

        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_LIST_END, this.raw[idx]));

        const excessStart = idx + 1;
        const excess = this.raw.slice(excessStart);
        if (excess.match(/[^\s]/g)) {
            throw new MethodParamsTokenizerException(`Unexpected out of bound expression '${excess}'.`);
        }
    }

    parameter(idx:number):number {
        idx = this.parameterName(idx);

        idx = this._ignore(/\s/, idx);
        if (this.raw[idx] !== ':') {
            const lastName = this.tokens[this.tokens.length - 1].value;
            throw new MethodParamsTokenizerException(`Expected ':' after parameter '${lastName}'.`);
        }
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_NAME_VALUE_SEPARATOR, this.raw[idx]));

        idx = this._ignore(/\s/, idx + 1);
        try {
            idx = this.parameterValue(idx);
        } catch (e) {
            const paramName = this.tokens[this.tokens.length - 2].value;
            e.message = `${e.message} in parameter '${paramName}'.`;
            throw e;
        }
        return this._ignore(/\s/, idx);
    }

    parameterName(idx:number):number {
        const nameEnd = this._ignore(/\w/, idx);
        const name = this.raw.slice(idx, nameEnd);
        if (!name) {
            throw new MethodParamsTokenizerException(`Expected parameter name, found '${this.raw[idx]}'`);
        }

        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_NAME, name));
        return nameEnd;
    }

    parameterValue(idx:number):number {
        if (this.raw[idx].match(/'|"/)) {
            return this.stringLiteral(idx);
        }

        const valueEnd = this._until(/\s|,|\)/, idx);
        const value = this.raw.slice(idx, valueEnd);
        if (!this._checkPrimitiveValue(value)) {
            const msg = value.length === 0 ? `Missing value`
            : `Invalid value '${value}'. Expected number, boolean, string literal or name'`;
            throw new MethodParamsTokenizerException(msg);
        }
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_VALUE, value));
        return valueEnd;
    }

    stringLiteral(idx:number):number {
        const delimiter = this.raw[idx];
        const literalEndRegex = new RegExp(`(?:[^\\\\](?:\\\\{2})*)${delimiter}`);
        const result = literalEndRegex.exec(this.raw.slice(idx));
        if (result === null) {
            throw new MethodParamsTokenizerException(`Mismatched string literal delimiter '${delimiter}'`);
        }

        const matchBegin = idx + result.index;
        const matchLength = result[0].length;
        if (this.raw.slice(idx, matchBegin + matchLength).match(/\n/)) {
            throw new MethodParamsTokenizerException(`Invalid multiline string literal`);
        }

        const literalEnd = matchBegin + matchLength;
        const literal = this.raw.slice(idx, literalEnd);
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_VALUE, literal));
        return literalEnd;
    }

    _checkPrimitiveValue(value:string):boolean {
        if (value.match(/[A-Z_]/i)) {
            return this._checkNameValue(value);
        }
        return this._checkNumberValue(value);
    }

    _checkNameValue(value:string):boolean {
        return !value.match(/^\d/) && !value.match(/\W/);
    }

    _checkNumberValue(value:string):boolean {
        return !isNaN(Number(value).valueOf());
    }

    _ignore(ignore:RegExp, start:number):number {
        let iterator = start;
        while (iterator < this.raw.length && this.raw[iterator].match(ignore)) {
            iterator++;
        }
        return iterator;
    }

    _until(ignore:RegExp, start:number):number {
        let iterator = start;
        while (iterator < this.raw.length && !this.raw[iterator].match(ignore)) {
            iterator++;
        }
        return iterator;
    }
}
