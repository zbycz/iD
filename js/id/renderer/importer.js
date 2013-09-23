iD.Importer = function(context, dispatch) {
    var projection,
        gj = {},
        enable = true,
        svg;

    d3.select(window)
        .on('message', onmessage);

    function onmessage() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
        var allnodes = [];
        var ways = d3.event.data.map(function(line) {
            line.pop();
            var nodes = line.map(function(l) {
                return iD.Node({
                    loc: [l.lng, l.lat]
                });
            });
            allnodes = allnodes.concat(nodes);
            return iD.Way({
                tags: { area: 'yes' },
                nodes: nodes.map(function(n) {
                    return n.id;
                }).concat([nodes[0].id])
            });
        });

        context.perform.apply(context,
            allnodes.map(function(n) {
                return iD.actions.AddEntity(n);
            }).concat(ways.map(function(w) {
                return iD.actions.AddEntity(w);
            }))
            .concat(['Imported Extracted Features']));
    }
};
