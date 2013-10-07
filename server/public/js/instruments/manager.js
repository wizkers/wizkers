/**
 * This will provide a list of supported instruments, and return
 * the relevant:
 *  - Settings and diags screen
 *  - Link manager
 *  - Display widgets (at least one)
 */



var instrumentManager = function() {
    
    this.supportedInstruments = [
        { shortname: "onyx",      name: "SafeCast Onyx", type: OnyxInstrument} ,
        { shortname: "fluke28x",  name: "Fluke 287/289 Series multimeter", type:Fluke289Instrument},
        { shortname: "fcoledv1",  name: "Fried Circuits OLED backpack", type: FCOledInstrument },
    ];

        // Return a live view object for a given instrument type
    this.getInstrumentType = function(insType) {
        for (var i=0; i< this.supportedInstruments.length; i++) {
        if (this.supportedInstruments[i].shortname == insType) {
            return new this.supportedInstruments[i].type;
            }
        }
    };

    // Returns a new link manager for this instrument type:
    this.getLinkManager = function(insType, parent) {
        var ins = this.getInstrumentType(insType);
        return ins.getLinkManager(parent);
    }
        
};

_.extend(instrumentManager, Backbone.Events);
