/**
 * A screen to manage on-device data/logs and download it to
 * our database.
 */

window.Fluke289LogManagementView = Backbone.View.extend({

    initialize:function (options) {
        
    },
    
    
    render: function() {
        $(this.el).html(this.template());
        return this;
    }
    
});