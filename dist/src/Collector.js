"use strict";
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var typescript = require("typescript");
var util = require("./util");
var SyntaxKind = typescript.SyntaxKind;
var TypeFlags = typescript.TypeFlags;
/**
 * Walks declarations from a TypeScript programs, and builds up a map of
 * referenced types.
 */
var Collector = /** @class */ (function () {
    function Collector(program) {
        var _this = this;
        this.types = {
            Date: { type: 'alias', target: { type: 'string' } },
        };
        this.nodeMap = new Map();
        // Node Walking
        this._walkNode = function (node) {
            // Reentrant node walking.
            if (_this.nodeMap.has(node)) {
                return _this.nodeMap.get(node);
            }
            var nodeReference = {};
            _this.nodeMap.set(node, nodeReference);
            var result = null;
            if (node.kind === SyntaxKind.InterfaceDeclaration) {
                result = _this._walkInterfaceDeclaration(node);
            }
            else if (node.kind === SyntaxKind.ClassDeclaration) {
                result = _this._walkClassDeclaration(node);
            }
            else if (node.kind === SyntaxKind.MethodSignature) {
                result = _this._walkMethodSignature(node);
            }
            else if (node.kind === SyntaxKind.PropertySignature) {
                result = _this._walkPropertySignature(node);
            }
            else if (node.kind === SyntaxKind.TypeReference) {
                result = _this._walkTypeReferenceNode(node);
            }
            else if (node.kind === SyntaxKind.TypeAliasDeclaration) {
                result = _this._walkTypeAliasDeclaration(node);
            }
            else if (node.kind === SyntaxKind.EnumDeclaration) {
                result = _this._walkEnumDeclaration(node);
            }
            else if (node.kind === SyntaxKind.TypeLiteral) {
                result = _this._walkTypeLiteralNode(node);
            }
            else if (node.kind === SyntaxKind.ArrayType) {
                result = _this._walkArrayTypeNode(node);
            }
            else if (node.kind === SyntaxKind.UnionType) {
                result = _this._walkUnionTypeNode(node);
            }
            else if (node.kind === SyntaxKind.StringKeyword) {
                result = { type: 'string' };
            }
            else if (node.kind === SyntaxKind.NumberKeyword) {
                result = { type: 'number' };
            }
            else if (node.kind === SyntaxKind.BooleanKeyword) {
                result = { type: 'boolean' };
            }
            else if (node.kind === SyntaxKind.PropertyDeclaration) {
                result = _this._walkPropertySignature(node);
            }
            else if (node.kind === SyntaxKind.IndexedAccessType) {
                result = { type: 'string' };
            }
            else if (node.kind === SyntaxKind.Constructor) {
                // Nada.
            }
            else if (node.kind === SyntaxKind.ModuleDeclaration) {
                // Nada.
            }
            else if (node.kind === SyntaxKind.MethodDeclaration) {
                // Nada.
            }
            else if (node.kind === SyntaxKind.VariableDeclaration) {
                // Nada.
            }
            else {
                throw new Error("Don't know how to handle " + SyntaxKind[node.kind] + " nodes");
            }
            if (result) {
                Object.assign(nodeReference, result);
            }
            return nodeReference;
        };
        this._walkSymbol = function (symbol) {
            return _.map(symbol.getDeclarations(), function (d) { return _this._walkNode(d); });
        };
        // Type Walking
        this._walkType = function (type) {
            if (type.flags & TypeFlags.Object) {
                return _this._walkTypeReference(type);
            }
            else if (type.flags & TypeFlags.BooleanLike) {
                return _this._walkInterfaceType(type);
            }
            else if (type.flags & TypeFlags.Index) {
                return _this._walkNode(type.getSymbol().declarations[0]);
            }
            else if (type.flags & TypeFlags.String) {
                return { type: 'string' };
            }
            else if (type.flags & TypeFlags.Number) {
                return { type: 'number' };
            }
            else if (type.flags & TypeFlags.Boolean) {
                return { type: 'boolean' };
            }
            else {
                console.error(type);
                console.error(type.getSymbol().declarations[0].getSourceFile().fileName);
                throw new Error("Don't know how to handle type with flags: " + type.flags);
            }
        };
        this.checker = program.getTypeChecker();
    }
    Collector.prototype.addRootNode = function (node) {
        this._walkNode(node);
        var simpleNode = this.types[this._nameForSymbol(this._symbolForNode(node.name))];
        simpleNode.concrete = true;
    };
    Collector.prototype.mergeOverrides = function (node, name) {
        var existing = this.types[name];
        if (!existing) {
            throw new Error("Cannot override \"" + name + "\" - it was never included");
        }
        var overrides = node.members.map(this._walkNode);
        var overriddenNames = new Set(overrides.map(function (o) { return o.name; }));
        existing.members = _(existing.members)
            .filter(function (m) { return !overriddenNames.has(m.name); })
            .concat(overrides)
            .value();
    };
    Collector.prototype._walkClassDeclaration = function (node) {
        var _this = this;
        // TODO: How can we determine for sure that this is the global date?
        if (node.name.text === 'Date') {
            return { type: 'reference', target: 'Date' };
        }
        return this._addType(node, function () {
            var e_1, _a, e_2, _b;
            var inherits = [];
            if (node.heritageClauses) {
                try {
                    for (var _c = __values(node.heritageClauses), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var clause = _d.value;
                        try {
                            for (var _e = __values(clause.types), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var type = _f.value;
                                var symbol = _this._symbolForNode(type.expression);
                                _this._walkSymbol(symbol);
                                inherits.push(_this._nameForSymbol(symbol));
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            return {
                type: 'interface',
                members: node.members.map(_this._walkNode),
                inherits: inherits,
            };
        });
    };
    Collector.prototype._walkInterfaceDeclaration = function (node) {
        var _this = this;
        // TODO: How can we determine for sure that this is the global date?
        if (node.name.text === 'Date') {
            return { type: 'reference', target: 'Date' };
        }
        return this._addType(node, function () {
            var e_3, _a, e_4, _b;
            var inherits = [];
            if (node.heritageClauses) {
                try {
                    for (var _c = __values(node.heritageClauses), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var clause = _d.value;
                        try {
                            for (var _e = __values(clause.types), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var type = _f.value;
                                var symbol = _this._symbolForNode(type.expression);
                                _this._walkSymbol(symbol);
                                inherits.push(_this._nameForSymbol(symbol));
                            }
                        }
                        catch (e_4_1) { e_4 = { error: e_4_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                            }
                            finally { if (e_4) throw e_4.error; }
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
            return {
                type: 'interface',
                members: node.members.map(_this._walkNode),
                inherits: inherits,
            };
        });
    };
    Collector.prototype._walkMethodSignature = function (node) {
        var e_5, _a;
        var signature = this.checker.getSignatureFromDeclaration(node);
        var parameters = {};
        try {
            for (var _b = __values(signature.getParameters()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var parameter = _c.value;
                var parameterNode = parameter.valueDeclaration;
                parameters[parameter.getName()] = this._walkNode(parameterNode.type);
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_5) throw e_5.error; }
        }
        return {
            type: 'method',
            name: node.name.getText(),
            parameters: parameters,
            returns: this._walkNode(node.type),
        };
    };
    Collector.prototype._walkPropertySignature = function (node) {
        return {
            type: 'property',
            name: node.name.getText(),
            signature: this._walkNode(node.type),
        };
    };
    Collector.prototype._walkTypeReferenceNode = function (node) {
        return this._referenceForSymbol(this._symbolForNode(node.typeName));
    };
    Collector.prototype._walkTypeAliasDeclaration = function (node) {
        var _this = this;
        return this._addType(node, function () { return ({
            type: 'alias',
            target: _this._walkNode(node.type),
        }); });
    };
    Collector.prototype._walkEnumDeclaration = function (node) {
        return this._addType(node, function () {
            var values = node.members.map(function (m) {
                // If the user provides an initializer, use the value of the initializer
                // as the GQL enum value _unless_ the initializer is a numeric literal.
                if (m.initializer && m.initializer.kind !== SyntaxKind.NumericLiteral) {
                    /**
                     *  Enums with initializers can look like:
                     *
                     *    export enum Type {
                     *      CREATED  = <any>'CREATED',
                     *      ACCEPTED = <any>'ACCEPTED',
                     *    }
                     *
                     *    export enum Type {
                     *      CREATED  = 'CREATED',
                     *      ACCEPTED = 'ACCEPTED',
                     *    }
                     *
                     *    export enum Type {
                     *      CREATED  = "CREATED",
                     *      ACCEPTED = "ACCEPTED",
                     *    }
                     */
                    var target = _.last(m.initializer.getChildren()) || m.initializer;
                    return _.trim(target.getText(), "'\"");
                }
                else {
                    /**
                     *  For Enums without initializers (or with numeric literal initializers), emit the
                     *  EnumMember name as the value. Example:
                     *    export enum Type {
                     *      CREATED,
                     *      ACCEPTED,
                     *    }
                     */
                    return _.trim(m.name.getText(), "'\"");
                }
            });
            return {
                type: 'enum',
                values: values,
            };
        });
    };
    Collector.prototype._walkTypeLiteralNode = function (node) {
        return {
            type: 'literal object',
            members: node.members.map(this._walkNode),
        };
    };
    Collector.prototype._walkArrayTypeNode = function (node) {
        return {
            type: 'array',
            elements: [this._walkNode(node.elementType)],
        };
    };
    Collector.prototype._walkUnionTypeNode = function (node) {
        return {
            type: 'union',
            types: node.types.map(this._walkNode),
        };
    };
    Collector.prototype._walkTypeReference = function (type) {
        if (type.target && type.target.getSymbol().name === 'Array') {
            return {
                type: 'array',
                elements: type.typeArguments.map(this._walkType),
            };
        }
        else {
            throw new Error('Non-array type references not yet implemented');
        }
    };
    Collector.prototype._walkInterfaceType = function (type) {
        return this._referenceForSymbol(this._expandSymbol(type.getSymbol()));
    };
    // Utility
    Collector.prototype._addType = function (node, typeBuilder) {
        var name = this._nameForSymbol(this._symbolForNode(node.name));
        if (this.types[name])
            return this.types[name];
        var type = typeBuilder();
        type.documentation = util.documentationForNode(node);
        this.types[name] = type;
        return type;
    };
    Collector.prototype._symbolForNode = function (node) {
        return this._expandSymbol(this.checker.getSymbolAtLocation(node));
    };
    Collector.prototype._nameForSymbol = function (symbol) {
        symbol = this._expandSymbol(symbol);
        var parts = [];
        while (symbol) {
            parts.unshift(this.checker.symbolToString(symbol));
            symbol = symbol['parent'];
            // Don't include raw module names.
            if (symbol && symbol.flags === typescript.SymbolFlags.ValueModule)
                break;
        }
        return parts.join('.');
    };
    Collector.prototype._expandSymbol = function (symbol) {
        while (symbol.flags & typescript.SymbolFlags.Alias) {
            symbol = this.checker.getAliasedSymbol(symbol);
        }
        return symbol;
    };
    Collector.prototype._referenceForSymbol = function (symbol) {
        this._walkSymbol(symbol);
        var referenced = this.types[this._nameForSymbol(symbol)];
        if (referenced && referenced.type === 'interface') {
            referenced.concrete = true;
        }
        return {
            type: 'reference',
            target: this._nameForSymbol(symbol),
        };
    };
    return Collector;
}());
exports.default = Collector;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQSwwQkFBNEI7QUFDNUIsdUNBQXlDO0FBR3pDLDZCQUErQjtBQUUvQixJQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDO0FBQ3pDLElBQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUM7QUFFdkM7OztHQUdHO0FBQ0g7SUFPRSxtQkFBWSxPQUEwQjtRQUF0QyxpQkFFQztRQVJELFVBQUssR0FBaUI7WUFDcEIsSUFBSSxFQUFFLEVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFDLEVBQUM7U0FDaEQsQ0FBQztRQUVNLFlBQU8sR0FBb0MsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQXlCN0QsZUFBZTtRQUVmLGNBQVMsR0FBRyxVQUFDLElBQW9CO1lBQy9CLDBCQUEwQjtZQUMxQixJQUFJLEtBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUMxQixPQUFPLEtBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBZSxDQUFDO2FBQzdDO1lBQ0QsSUFBTSxhQUFhLEdBQTBCLEVBQUUsQ0FBQztZQUNoRCxLQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFFdEMsSUFBSSxNQUFNLEdBQW1CLElBQUksQ0FBQztZQUNsQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLG9CQUFvQixFQUFFO2dCQUNqRCxNQUFNLEdBQUcsS0FBSSxDQUFDLHlCQUF5QixDQUFrQyxJQUFJLENBQUMsQ0FBQzthQUNoRjtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLGdCQUFnQixFQUFFO2dCQUNw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