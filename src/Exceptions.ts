import * as typescript from 'typescript';

export class TranspilationError extends Error {
    protected fileName:string;
    protected lineNumber:number;
    constructor(node:typescript.Node, msg:string) {
        super(msg);
        const src = node.getSourceFile();
        this.fileName = fileOnly(src.fileName);
        this.lineNumber = src.getLineAndCharacterOfPosition(node.getStart(src, false)).line + 1;
    }

    protected fileAndLine = ():string => {
        return `(${this.fileName}:${this.lineNumber})`;
    }
}

export class InterfaceError extends TranspilationError {
    constructor(node:typescript.InterfaceDeclaration, msg:string) {
        super(node, msg);
        this.message = `At interface '${node.name.getText()}'${this.fileAndLine()}\n${this.message}`;
    }
}

export class PropertyError extends TranspilationError {
    constructor(node:typescript.TypeElement, msg:string) {
        super(node, msg);
        this.message = `At property '${node.name!.getText()}'${this.fileAndLine()}\n${this.message}`;
    }
}

export class InputValueError extends TranspilationError {
    constructor(node:typescript.ParameterDeclaration, msg:string) {
        super(node, msg);
        this.message = `At parameter '${node.name.getText()}'${this.fileAndLine()}\n${this.message}`;
    }
}

export class TypeAliasError extends TranspilationError {
    constructor(node:typescript.TypeAliasDeclaration, msg:string) {
        super(node, msg);
        this.message = `At type '${node.name.getText()}'${this.fileAndLine()}\n${this.message}`;
    }
}

export class EnumError extends TranspilationError {
    constructor(node:typescript.EnumDeclaration, msg:string) {
        super(node, msg);
        this.message = `At enum '${node.name.getText()}'${this.fileAndLine()}\n${this.message}`;
    }
}

const fileOnly = (path:string):string => {
    const splitted = path.split('/');
    return splitted[splitted.length - 1];
};
