/**
 * A W433 custom weather receiver This
 * object implements a standard API shared by all instrument
 * objects:
 */


var W433Instrument = function() {

    // Helper function: get driver capabilites.
    // returns a simple array of capabilities    
    this.getCaps = function() {
        return ["LiveDisplay", "NumDisplay", "LogView"];
    };
        
    // This has to be a Backbone view
    this.getLiveDisplay = function(arg) {
        return new W433LiveView(arg);
    };
    
        // This is a Backbone view
    // This is a numeric display
    this.getNumDisplay = function(arg) {
        return new W433NumView(arg);
    };
    
    // A diagnostics/device setup screen
    this.getDiagDisplay = function(arg) {
        return new W433DiagView(arg);
    };
    
    // This has to be a link manager
    this.getLinkManager = function(arg) {
        return new W433LinkManager(arg);
    };
    
    // Return a Backbone view which is a mini graph
    this.getMiniLogview = function(arg) {
        return null;
    };
    
    // Render a log (or list of logs) for the device.
    this.getLogView = function(arg) {
        return new W433LogView(arg);
    }
    
    
};
