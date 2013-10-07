/**
 * A Fluke 287/289 series instrument. This
 * object implements a standard API shared by all instrument
 * objects:
 */


var Fluke289Instrument = function() {
    
    // This has to be a backbone view
    this.getSettings = function(arg) {
        return new Fluke289Settings(arg);
    };
    
    // This has to be a Backbone view
    this.getLiveDisplay = function(arg) {
        return new Fluke289LiveView(arg);
    };
    
    // This has to be a link manager
    this.getLinkManager = function(arg) {
        return new Fluke289LinkManager(arg);
    };
    
    
};
