"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
// Chai
// We prefer Chai's `expect` interface.
global.expect = chai.expect;
// Give us all the info!
chai.config.truncateThreshold = 0;
// Promise-aware chai assertions (that return promises themselves):
//
//   await expect(promise).to.be.rejectedWith(/error/i);
//
chai.use(chaiAsPromised);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3Rlc3QvZW52L2Jhc2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwyQkFBNkI7QUFDN0IsaURBQW1EO0FBRW5ELE9BQU87QUFFUCx1Q0FBdUM7QUFDdkMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQzVCLHdCQUF3QjtBQUN4QixJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQztBQUVsQyxtRUFBbUU7QUFDbkUsRUFBRTtBQUNGLHdEQUF3RDtBQUN4RCxFQUFFO0FBQ0YsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQyJ9