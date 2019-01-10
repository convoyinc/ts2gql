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
        this.begin(0);

        return this.tokens;
    }

    begin(idx:number) {
        if ( this.raw[idx] !== '(') {
            throw new MethodParamsTokenizerException('Expected ( at the beginning of parameter list declaration.');
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
        try {
            idx = this.parameterValue(idx);
        } catch (e) {
            const paramName = this.tokens[this.tokens.length - 2].value;
            e.message = `${e.message} in parameter ${paramName}.`;
            throw e;
        }
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
        if (this.raw[idx].match(/('|")/))
            return this.stringLiteral(idx);
        
        const valueEnd = this._until(/\s|,|\)/, idx);
        const value = this.raw.slice(idx, valueEnd);
        if (!this._checkPrimitiveValue(value))
            throw new MethodParamsTokenizerException(`Invalid value ${value}`);
        
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
        if (this.raw[literalEnd - 1] !== delimiter) {
            throw new MethodParamsTokenizerException(`Mismatched string literal delimiter ${delimiter}.`);
        }
        const literal = this.raw.slice(idx, literalEnd);
        this.tokens.push(new MethodParamsToken(TokenType.PARAMETER_VALUE, literal));
        return literalEnd;
    }

    _checkPrimitiveValue(value:string):boolean {
        // Don't accept characters other than letters, digits, _, . and -
        // It must have at least one letter, digit or _
        const hasSomeChar = value.length > 0;
        const invalidChar = !!value.match(/[^A-Z0-9_\.-]/i);
        if (!hasSomeChar || invalidChar)
            return false;
        if (value.match(/[A-Z_]/i))
            return this._checkNameValue(value);
        return this._checkNumberValue(value);
    }

    _checkNameValue(value:string):boolean {
        // A name must not start with digits, or have non word characters
        return !value.match(/^\d/) && !value.match(/\W/);
    }

    _checkNumberValue(value:string):boolean {
        // There should be - at most once and always in the beginning of value
        const minusPos = value.lastIndexOf('-');
        if (minusPos > 0)
            return false;
        const positiveNumber =  minusPos === -1 ? value : value.slice(1);

        if (value.match(/\./))
            return this._checkPositiveFloatValue(positiveNumber);
        return this._checkPositiveIntValue(positiveNumber);
    }

    _checkPositiveFloatValue(value:string):boolean {
        const dots = value.match(/\./g);
        const dotIdx = value.indexOf('.');
        return dots !== null && dots.length === 1 && dotIdx !== value.length - 1 
        && this._checkPositiveIntValue(value.slice(0, dotIdx)) 
        && this._checkDecimalValue(value.slice(dotIdx + 1));
    }

    _checkPositiveIntValue(value:string):boolean {
        return value.length > 0 && !value.match(/\D/) && (value.length === 1 || !value.match(/^0/));
    }

    _checkDecimalValue(value:string):boolean {
        return value.length > 0 && !value.match(/\D/);
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
        while (iterator < this.raw.length && !this.raw.slice(iterator, iterator + sublen).match(ignore)) {
            iterator++;
        }
        return iterator;
    }
}
