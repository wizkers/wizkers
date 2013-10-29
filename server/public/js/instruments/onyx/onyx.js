/**
 * A Safecast Onyx instrument
 */


var OnyxInstrument = function() {
    
        // Helper function: get driver capabilites.
    // returns a simple array of capabilities    
    this.getCaps = function() {
        return ["LiveDisplay", "NumDisplay", "DiagDisplay", "LogView",
                "LogManagementView",
               ];
    };

    // This has to be a backbone view
    this.getSettings = function(arg) {
        return new OnyxSettings(arg);
    };
    
    // This has to be a Backbone view
    // This is the full screen live view graph (not a small widget)
    this.getLiveDisplay = function(arg) {
        return new OnyxLiveView(arg);
    };
    
    // This is a Backbone view
    // This is a numeric display
    this.getNumDisplay = function(arg) {
        return new OnyxNumView(arg);
    };
    
    // A smaller widget (just a graph)
    this.getLiveWidget = function(arg) {
        return new OnyxLiveWidget(arg);
    };
    
    // A diagnostics/device setup screen
    this.getDiagDisplay = function(arg) {
        return new OnyxDiagView(arg);
    };

    
    // This has to be a link manager
    this.getLinkManager = function(arg) {
        return new OnyxLinkManager(arg);
    };
    
    // Return a Backbone view which is a mini graph
    this.getMiniLogview = function(arg) {
        return null;
    };
    
    // Return a device log management view
    this.getLogManagementView = function(arg) {
        return new OnyxLogManagementView(arg);
    }
    
    // Render a log (or list of logs) for the device.
    this.getLogView = function(arg) {
        return new OnyxLogView(arg);
    }

    
};
