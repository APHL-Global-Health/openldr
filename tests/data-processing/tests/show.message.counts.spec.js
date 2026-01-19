import { expect } from 'chai';
import * as utils from  '../../utils.js';

describe('OpenLDR Message Count Monitor', function() {
    this.timeout(10000);

    describe('Accessible', function() {
      it('should be accessible', async function() {
        const isAccessible = await utils.checkOpensearch();
        expect(isAccessible).to.be.equal(true);
      });
    });

    describe('Current Message Counts', function() {
      it('should get raw inbound message count', async function() {
        const count = await utils.getIndexCount('raw-inbound');
        expect(count).to.be.a('number');
        console.log(`Raw Inbound: ${count} messages`);
      });

      it('should get validated inbound message count', async function() {
        const count = await utils.getIndexCount('validated-inbound');
        expect(count).to.be.a('number');
        console.log(`Validated Inbound: ${count} messages`);
      });

      it('should get mapped inbound message count', async function() {
        const count = await utils.getIndexCount('mapped-inbound');
        expect(count).to.be.a('number');
        console.log(`Mapped Inbound: ${count} messages`);
      });

      it('should get processed inbound message count', async function() {
        const count = await utils.getIndexCount('processed-inbound');
        expect(count).to.be.a('number');
        console.log(`Processed Inbound: ${count} messages`);
      });
    });
});