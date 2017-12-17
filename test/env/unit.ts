import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { withMocha } from '../helpers';

import './base';

// Chai

// http://chaijs.com/plugins/sinon-chai
//
// Adds assertions for sinon spies.
//
//   expect(aSpy).to.have.been.calledWith('abc', 123)
//
chai.use(sinonChai);

// Test Environment

withMocha(() => {

  beforeEach(() => {
    // Prefer accessing sinon via the `sandbox` global.
    global.sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    global.sandbox.restore();
    delete global.sandbox;
  });

});
