/**
 * This will provide a list of supported instruments, and return
 * the relevant:
 *  - Settings and diags screen
 *  - Link manager
 *  - Display widgets (at least one)
 */



var InstrumentManager = function() {
    
    this.instrument = null; // A Backbone Model
    
    this.supportedInstruments = [
        { shortname: "onyx",      name: "SafeCast Onyx", type: OnyxInstrument} ,
        { shortname: "fluke28x",  name: "Fluke 287/289 Series multimeter", type:Fluke289Instrument},
        { shortname: "fcoledv1",  name: "Fried Circuits OLED backpack", type: FCOledInstrument },
    ];
        
    this.setInstrument = function(instrument) {
        var type = instrument.get('type');
        for (var i=0; i< this.supportedInstruments.length; i++) {
        if (this.supportedInstruments[i].shortname == type) {
            this.instrument = instrument;
            // Nifty: we extend our link manager with the methods of our instrument.
            // (since all instruments support the same API, a change of instrument
            // overrides the methods)
            var instrumentObject =new this.supportedInstruments[i].type;
            _.extend(this,instrumentObject);
            this.trigger('instrumentChanged'); // Tell views who rely on the instrument manager...
            }
        }
    }
    
    this.getInstrument = function() {
        return this.instrument;
    }

    // Returns a new link manager for this instrument type:
/*    this.getLinkManager = function(parent) {
        // var ins = this.getInstrumentType(insType);
        return this.currentInstrument.getLinkManager(parent);
    }
    
    this.getLiveDisplay = function(arg) {
        return this.currentInstrument.getLiveDisplay(arg);
    }
*/
        
};

_.extend(InstrumentManager.prototype, Backbone.Events);
