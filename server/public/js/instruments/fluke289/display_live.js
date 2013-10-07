// Live view for the Fluke 289
// 
// Our model is the settings object.

window.Fluke289LiveView = Backbone.View.extend({

    initialize:function (options) {
        this.linkManager = this.options.lm;
        this.settings = this.model;
    },
    
    
    events: {
    },
    
    render:function () {
        var self = this;
        console.log('Main render of Fluke289 live view');
        $(this.el).html(this.template());
        return this;
    },
        
    onClose: function() {
        console.log("Fluke289 live view closing...");        
    },

    
});