iD.Gpx = function() {
    var tileSize = 256,
        tile = d3.geo.tile(),
        projection,
        cache = {},
        offset = [0, 0],
        tileOrigin,
        z,
        transformProp = iD.util.prefixCSSProperty('Transform'),
        source = d3.functor('');

    function tileSizeAtZoom(d, z) {
        return Math.ceil(tileSize * Math.pow(2, z - d[2])) / tileSize;
    }

    // Update tiles based on current state of `projection`.
    function background(selection) {
        tile.scale(projection.scale())
            .translate(projection.translate());

        tileOrigin = [
            projection.scale() / 2 - projection.translate()[0],
            projection.scale() / 2 - projection.translate()[1]];

        z = Math.max(Math.log(projection.scale()) / Math.log(2) - 8, 0);

        render(selection);
    }

    // Derive the tiles onscreen, remove those offscreen and position them.
    // Important that this part not depend on `projection` because it's
    // rentered when tiles load/error (see #644).
    function render(selection) {

        var requests = tile();

        function imageTransform(d) {
            var _ts = tileSize * Math.pow(2, z - d[2]);
            var scale = tileSizeAtZoom(d, z);
            return 'translate(' +
                (Math.round((d[0] * _ts) - tileOrigin[0])) + 'px,' +
                (Math.round((d[1] * _ts) - tileOrigin[1])) + 'px)' +
                'scale(' + scale + ',' + scale + ')';
        }

        var canvas = selection
            .selectAll('canvas')
            .data(requests, function(d) { return d.join(','); });

        canvas.exit()
            .style(transformProp, imageTransform)
            .classed('tile-loaded', false)
            .each(function() {
                var tile = this;
                window.setTimeout(function() {
                    // this tile may already be removed
                    if (tile.parentNode) {
                        tile.parentNode.removeChild(tile);
                    }
                }, 300);
            });

        canvas.enter().append('canvas')
            .attr('class', 'tile')
            .each(function(d) {
                gpsTile(d, this, function() {});
            });

        canvas.style(transformProp, imageTransform);
    }

    background.projection = function(_) {
        if (!arguments.length) return projection;
        projection = _;
        return background;
    };

    background.size = function(_) {
        if (!arguments.length) return tile.size();
        tile.size(_);
        return background;
    };

    return background;
};
