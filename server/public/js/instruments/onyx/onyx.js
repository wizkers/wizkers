/**
 * A Safecast Onyx instrument
 */


var OnyxInstrument = function() {
    
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
        return null;
        return new OnyxDiagView(arg);
    };

    
    // This has to be a link manager
    this.getLinkManager = function(arg) {
        return new OnyxLinkManager(arg);
    };
    
    
};
