"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var sinon = require("sinon");
var sinonChai = require("sinon-chai");
var helpers_1 = require("../helpers");
require("./base");
// Chai
// http://chaijs.com/plugins/sinon-chai
//
// Adds assertions for sinon spies.
//
//   expect(aSpy).to.have.been.calledWith('abc', 123)
//
chai.use(sinonChai);
// Test Environment
helpers_1.withMocha(function () {
    beforeEach(function () {
        // Prefer accessing sinon via the `sandbox` global.
        global.sandbox = sinon.sandbox.create();
    });
    afterEach(function () {
        global.sandbox.restore();
        delete global.sandbox;
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3Rlc3QvZW52L3VuaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwyQkFBNkI7QUFDN0IsNkJBQStCO0FBQy9CLHNDQUF3QztBQUV4QyxzQ0FBdUM7QUFFdkMsa0JBQWdCO0FBRWhCLE9BQU87QUFFUCx1Q0FBdUM7QUFDdkMsRUFBRTtBQUNGLG1DQUFtQztBQUNuQyxFQUFFO0FBQ0YscURBQXFEO0FBQ3JELEVBQUU7QUFDRixJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBRXBCLG1CQUFtQjtBQUVuQixtQkFBUyxDQUFDO0lBRVIsVUFBVSxDQUFDO1FBQ1QsbURBQW1EO1FBQ25ELE1BQU0sQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUMxQyxDQUFDLENBQUMsQ0FBQztJQUVILFNBQVMsQ0FBQztRQUNSLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDekIsT0FBTyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQ3hCLENBQUMsQ0FBQyxDQUFDO0FBRUwsQ0FBQyxDQUFDLENBQUMifQ==