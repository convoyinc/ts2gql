import * as sinon from 'sinon';

declare global {
  const sandbox: sinon.SinonSandbox;

  namespace NodeJS {
    export interface Global {
      sandbox: sinon.SinonSandbox;
    }
  }
}
