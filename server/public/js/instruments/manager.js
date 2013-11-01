/**
 * This will provide a list of supported instruments, and return
 * the relevant:
 *  - Settings and diags screen
 *  - Link manager
 *  - Display widgets (at least one)
 */



var InstrumentManager = function() {
    
    this.instrument = null; // A Backbone Model
    
    this.supportedInstruments = {
        "onyx": {      name: "SafeCast Onyx", type: OnyxInstrument, settings: OnyxSettingsView} ,
        "fluke28x": {  name: "Fluke 287/289 Series multimeter", type:Fluke289Instrument, settings: Fluke289SettingsView},
        "fcoledv1": {  name: "Fried Circuits OLED backpack", type: FCOledInstrument, settings: FCOledSettingsView },
        "w433": {      name: "Aerodynes W433 Weather receiver", type: W433Instrument, settings: W433SettingsView },
    };
        
    this.setInstrument = function(instrument) {
        var type = instrument.get('type');
        for (var ins in this.supportedInstruments) {
        if (ins == type) {
            this.instrument = instrument;
            // Nifty: we extend our link manager with the methods of our instrument.
            // (since all instruments support the same API, a change of instrument
            // overrides the methods)
            var instrumentObject =new this.supportedInstruments[ins].type;
            _.extend(this,instrumentObject);
            this.trigger('instrumentChanged'); // Tell views who rely on the instrument manager...
            }
        }
    }
    
    this.getInstrument = function() {
        return this.instrument;
    }
        
};

_.extend(InstrumentManager.prototype, Backbone.Events);
