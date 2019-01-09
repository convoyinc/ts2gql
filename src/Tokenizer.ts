export enum TokenType {
    PARAMETER_LIST_BEGIN,
    PARAMETER_NAME,
    PARAMETER_NAME_VALUE_SEPARATOR,
    PARAMETER_VALUE,
    PARAMETER_SEPARATOR,
    PARAMETER_LIST_END,
}

export class MethodParamsToken {
    public type:TokenType;
    public value:string;

    constructor(type:TokenType, value:string) {
        this.type = type;
        this.value = value;
    }
}

export class MethodParamsTokenizerException extends Error {}

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
        this.begin(0);

        return this.tokens;
    }

    begin(idx:number) {
        if ( this.raw[idx] !== '(') {
            throw new MethodParamsTokenizerException('Expected ( before parameter list declaration.');
        }

        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_LIST_BEGIN, this.raw[idx]));
        idx = this._ignore(/\s/, idx + 1);
        while (idx < this.raw.length && this.raw[idx] !== ')') {
            if (this.tokens.length > 1) {
                if (this.raw[idx] !== ',') {
                    throw new MethodParamsTokenizerException('Expected , between parameter definitions.');
                }
                this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_SEPARATOR, ','));
                idx = this._ignore(/\s/, idx + 1);
            }
            idx = this.parameter(idx);
        }

        if (idx === this.raw.length)
            throw new MethodParamsTokenizerException('Expected ) at the end of parameter list declaration.');
        
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_LIST_END, this.raw[idx]));
    }

    parameter(idx:number):number {
        idx = this.parameterName(idx);
        
        if (this.raw[idx] !== ':') {
            const lastName = this.tokens[this.tokens.length - 1].value;
            throw new MethodParamsTokenizerException(`Expected : after parameter ${lastName}.`);
        }
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_NAME_VALUE_SEPARATOR, this.raw[idx]));

        idx = this._ignore(/\s/, idx + 1);
        idx = this.parameterValue(idx);
        return this._ignore(/\s/, idx);
    }

    parameterName(idx:number):number {
        const nameEnd = this._ignore(/\w/, idx);
        const name = this.raw.slice(idx, nameEnd);
        if (!name)
            throw new MethodParamsTokenizerException(`Expected parameter name, found ${this.raw[idx]}`);
        
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_NAME, name));
        return nameEnd;
    }

    parameterValue(idx:number):number {
        if (this.raw[idx].match(/'|"/))
            return this.stringLiteral(idx);
        
        const valueEnd = this._ignore(/\w|\./, idx);
        const value = this.raw.slice(idx, valueEnd);
        if (!value.match(/\w/) || (value.match(/[A-Z]/i) && value.match(/^\d/)) 
        || (value.match(/[A-Z]/i) && value.match(/\./)))
            throw new MethodParamsTokenizerException(`Invalid parameter value ${value}`);
        
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_VALUE, value));
        return valueEnd;
    }

    stringLiteral(idx:number):number {
        const delimiter = this.raw[idx];
        const matchStep = 2;
        const matchedEnd = this._until(new RegExp(`([^\\\\]${delimiter})|\\n`), idx, matchStep);
        if (this.raw.slice(matchedEnd, matchedEnd + matchStep).match(/\n/)) {
            throw new MethodParamsTokenizerException(`Invalid multiline string literal`);
        }
        
        const literalEnd = matchedEnd + matchStep;
        const literal = this.raw.slice(idx, literalEnd);
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_VALUE, literal));
        return literalEnd;
    }

    _ignore(ignore:RegExp, start:number, sublen = 1):number {
        let iterator = start;
        while (iterator < this.raw.length - sublen + 1 && this.raw.slice(iterator, iterator + sublen).match(ignore)) {
            iterator++;
        }
        return iterator;
    }

    _until(ignore:RegExp, start:number, sublen = 1):number {
        let iterator = start;
        while (start < this.raw.length && !this.raw.slice(iterator, iterator + sublen).match(ignore)) {
            iterator++;
        }
        return iterator;
    }

}
