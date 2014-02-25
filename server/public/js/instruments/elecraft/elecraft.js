/**
 * An Elecraft radio This
 * object implements the standard API shared by all instruments
 * objects:
 */


var ElecraftInstrument = function() {

    // Helper function: get driver capabilites.
    // returns a simple array of capabilities    
    this.getCaps = function() {
        return ["LiveDisplay", "NumDisplay", "DiagDisplay"];
    };
        
    // This has to be a Backbone view
    this.getLiveDisplay = function(arg) {
        return new ElecraftLiveView(arg);
    };
    
        // This is a Backbone view
    // This is a numeric display
    this.getNumDisplay = function(arg) {
        return new ElecraftNumView(arg);
    };
    
    // A diagnostics/device setup screen
    this.getDiagDisplay = function(arg) {
        return new ElecraftDiagView(arg);
    };
    
    // This has to be a link manager
    this.getLinkManager = function(arg) {
        return new ElecraftLinkManager(arg);
    };
    
    // Return a Backbone view which is a mini graph
    this.getMiniLogview = function(arg) {
        return null;
    };
    
    // Render a log (or list of logs) for the device.
    this.getLogView = function(arg) {
        return new ElecraftLogView(arg);
    }

};
