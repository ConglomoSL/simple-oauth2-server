module.exports = extendPrototypeLowDB;

function extendPrototypeLowDB() {
    for (let i = 0; i < arguments.length; i++) {
        arguments[i]._.prototype.hasRec = function(key, value) {
            const filter = typeof key === 'object' ? key : {
                [key]: value
            };
            return this.find(filter).value() ? true : false;
        }
    }
}
