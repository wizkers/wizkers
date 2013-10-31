
// 
// Our model is the settings object.

window.W433NumView = Backbone.View.extend({

    initialize:function (options) {

    },
    
    events: {
    },
    
    render:function () {
        var self = this;
        console.log('Main render of W433 numeric view');
        $(this.el).html(this.template());
        return this;
    },
        
    onClose: function() {
        console.log("W433 numeric view closing...");
    },
        
});
