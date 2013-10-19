/**
 * A FriedCirctuits OLED Backpack instrument
 */


var FCOledInstrument = function() {
    
        // Helper function: get driver capabilites.
    // returns a simple array of capabilities    
    this.getCaps = function() {
        return ["LiveDisplay",  "NumDisplay", ];
    };

    // This has to be a backbone view
    this.getSettings = function(arg) {
        return new FCOledSettings(arg);
    };
    
    // This has to be a Backbone view
    // This is the full screen live view (not a small widget)
    this.getLiveDisplay = function(arg) {
        return new FCOledLiveView(arg);
    };
    
        // This is a Backbone view
    // This is a numeric display
    this.getNumDisplay = function(arg) {
        return new FCOledNumView(arg);
    };
    
    // A diagnostics/device setup screen
    this.getDiagDisplay = function(arg) {
        return null;
        return new FCOledDiagView(arg);
    };

    
    // A smaller widget (just a graph)
    this.getLiveWidget = function(arg) {
        return new FCOledLiveWidget(arg);
    };
    
    // This has to be a link manager
    this.getLinkManager = function(arg) {
        return new FCOledLinkManager(arg);
    };
    
    // Return a Backbone view which is a mini graph
    this.getMiniLogview = function(arg) {
        return null;
    };
    
    // Return a device log management view
    this.getLogManagementView = function(arg) {
        return null;
    }
    
    // Render a log (or list of logs) for the device.
    this.getLogView = function(arg) {
        return null;
    }

};