window.ElecraftFrequencyListView = Backbone.View.extend({

    tagName: "div",
    className: "carousel-inner",
    
    initialize: function (options) {
        this.options = options || {};
    },

    render: function () {
        // var frequencies = this.model.models;
        var frequencies = [0,0,0,0,0,0,0,0,0,0,0,0]; // test
        var len = frequencies.length;
        console.log("Frequency list: " + len + " frequencies");

        $(this.el).html('<div class="item active"></div><div class="item other"></div>');
        
        for (var screen = 0; screen < len/4; screen++) {
            for (var i = screen*4; i < Math.min(len,screen+4); i++) {
                $(screen ? '.other' : '.active', this.el).append(new ElecraftFrequencyItemView({model: frequencies[i]}).render().el);
            }
        }

        return this;
    }
});

window.ElecraftFrequencyItemView = Backbone.View.extend({

    tagName: "div",
    className: "col-md-3",

    initialize: function () {
        // this.model.bind("change", this.render, this);
        // this.model.bind("destroy", this.close, this);
    },

    render: function () {
//        $(this.el).html(this.template(this.model.toJSON()));
        $(this.el).html(this.template());
        return this;
    },
    
    events: {
        "click .select" : "selectFrequency",
        "click .edit": "editFrequency"
    },
    
    editFrequency: function(event) {
        var url = event.target.href.substr(event.target.baseURI.length);
        // app.navigate(url, {trigger: true});
        // event.stopPropagation();
    },

    selectFrequency: function(event) {
        console.log('Frequency selected: ' + this.model.id);
        var theID = this.model.id;
        return false;
    },
    

});