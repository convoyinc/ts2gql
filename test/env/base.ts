import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

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
