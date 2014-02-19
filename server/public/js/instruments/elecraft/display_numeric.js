/**
 *  
 */

window.ElecraftNumView = Backbone.View.extend({

    initialize:function () {
        this.render();
    },

    render:function () {
        $(this.el).html(this.template());
        return this;
    },
    
    onClose: function() {
        console.log("Elecraft numeric view closing...");        
    },


});
