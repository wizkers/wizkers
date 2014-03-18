
// Model is the instrument
window.SampleInstrumentNumView = Backbone.View.extend({

    initialize:function () {
        this.render();
    },

    render:function () {
        $(this.el).html(this.template());
        return this;
    },
    
    onClose: function() {
        console.log("Instrument numeric view closing...");        
    },


});