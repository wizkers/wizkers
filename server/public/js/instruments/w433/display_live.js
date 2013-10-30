// Live view for the Fluke 289
// 
// Our model is the settings object.

window.W433LiveView = Backbone.View.extend({

    initialize:function (options) {
        this.settings = this.model;        

        linkManager.on('input', this.showInput, this);
        
    },
    
    events: {

    },
    
    render:function () {
        $(this.el).html(this.template());            
        return this;
    },
        
    onClose: function() {
        linkManager.off('input', this.showInput);
    },

    
    // We get there whenever we receive something from the serial port
    showInput: function(data) {
        // Update our raw data monitor
        var i = $('#input',this.el);
        var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
        // Keep max 50 lines:
        if (scroll.length > 50) {
            scroll = scroll.slice(scroll.length-50);
        }
        i.val(scroll.join('\n'));
        // Autoscroll:
        i.scrollTop(i[0].scrollHeight - i.height());        
    },

});