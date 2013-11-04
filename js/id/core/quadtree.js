iD.Quadtree = function(connection) {
    var SM = new SphericalMercator(),
        densityThreshold = 512;

    function Node(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    Node.prototype.split = function() {
        if (this.nw) return;
        var x2 = this.x * 2,
            y2 = this.y * 2,
            z1 = this.z + 1;
        this.nw = new Node(x2,     y2,     z1);
        this.ne = new Node(x2 + 1, y2,     z1);
        this.sw = new Node(x2,     y2 + 1, z1);
        this.se = new Node(x2 + 1, y2 + 1, z1);
    };

    Node.prototype.extent = function() {
        var bbox = SM.bbox(this.x, this.y, this.z);
        return iD.geo.Extent([bbox[0], bbox[1]], [bbox[2], bbox[3]]);
    };

    Node.prototype.log = function() {
        var space = '';
        for (var i = 0; i < this.z; i++) space += ' ';
        console.log.apply(console, [space, this.x, this.y, this.z].concat(arguments))
    };

    Node.prototype.load = function(extent, minZ, maxZ, dense, sparse) {
        var point = extent.center();

        if (!this.extent().contains(point))
            return;

        if (this.data)
            return;

        if (this.z < maxZ) {
            var ifDense = function() {
                if (this.z + 1 >= minZ) return; // Too dense; abort.
                this.nw.load(extent.intersection(this.nw.extent()), minZ, maxZ);
                this.ne.load(extent.intersection(this.ne.extent()), minZ, maxZ);
                this.sw.load(extent.intersection(this.sw.extent()), minZ, maxZ);
                this.se.load(extent.intersection(this.se.extent()), minZ, maxZ);
                if (dense) dense();
            }.bind(this);

            var ifSparse = function() {
                this.load(extent, minZ, this.z, dense, sparse);
            }.bind(this);

            this.split();
            this.nw.load(extent, minZ, maxZ, ifDense, ifSparse); // Only one of
            this.ne.load(extent, minZ, maxZ, ifDense, ifSparse); // these will
            this.sw.load(extent, minZ, maxZ, ifDense, ifSparse); // contain the
            this.se.load(extent, minZ, maxZ, ifDense, ifSparse); // center point.

        } else if (!this.request) {
            this.log("loading");
            this.status = 'loading';
            this.request = connection.loadExtent(this.extent(), function(err, entities) {
                this.request = null;

                var e = this.extent(),
                    c = 0;

                for (var i = 0; i < entities.length; i++) {
                    var entity = entities[i];
                    if (entity.type === 'node' && e.contains(entity.loc))
                        c++;
                }

                if (c > densityThreshold) {
                    this.status = 'dense (' + c + ')';
                    this.data = entities;
                    if (dense) dense();
                } else {
                    this.status = 'sparse (' + c + ')';
                    this.data = entities;
                    if (sparse) sparse();
                }
            }.bind(this));
        }
    };

    // Abort pending requests outside extent.
    Node.prototype.abort = function(extent) {
        if (!this.extent().intersects(extent) && this.request) {
            this.request.abort();
            this.request = null;
        }

        if (this.nw) {
            this.nw.abort(extent);
            this.ne.abort(extent);
            this.sw.abort(extent);
            this.se.abort(extent);
        }
    };

    Node.prototype.zoom = function(extent) {
        if (!this.extent().intersects(extent))
            return 0;

        if (this.data && this.data.length > densityThreshold)
            return this.z;

        if (!this.nw)
            return 0;

        return Math.max(this.nw.zoom(extent),
                        this.ne.zoom(extent),
                        this.sw.zoom(extent),
                        this.se.zoom(extent));
    };

    Node.prototype.nodes = function(extent) {
        if (!this.extent().intersects(extent))
            return [];

        if (this.status || !this.nw)
            return [this];

        return _.flatten([
            this.nw.nodes(extent),
            this.ne.nodes(extent),
            this.sw.nodes(extent),
            this.se.nodes(extent)]);
    };

    function quadtree(x, y, z) {
        return new Node(x, y, z)
    }

    // Maximum desired entities per tile.
    quadtree.densityThreshold = function(_) {
        if (!arguments.length) return densityThreshold;
        densityThreshold = _;
        return quadtree;
    };

    return quadtree;
};
