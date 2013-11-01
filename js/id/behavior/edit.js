iD.behavior.Edit = function(context) {
    function edit() {
        context.map().zoomFloor(true);
    }

    edit.off = function() {
        context.map().zoomFloor(false);
    };

    return edit;
};
