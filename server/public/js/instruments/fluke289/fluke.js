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
    
        // This is a Backbone view
    // This is a numeric display
    this.getNumDisplay = function(arg) {
        return new Fluke289NumView(arg);
    };
    
    // A diagnostics/device setup screen
    this.getDiagDisplay = function(arg) {
        return new Fluke289DiagView(arg);
    };
    
    // This has to be a link manager
    this.getLinkManager = function(arg) {
        return new Fluke289LinkManager(arg);
    };
    
    // Return a Backbone view which is a mini graph
    this.getMiniLogview = function(arg) {
        return null;
    };
    
    // Return a device log management view
    this.getLogManagementView = function(arg) {
        return new Fluke289LogManagementView(arg);
    }
    
    // Render a log (or list of logs) for the device.
    this.getLogView = function(arg) {
        return new Fluke289LogView(arg);
    }
    
    
};
