"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Calls `callback` once Mocha has loaded its environment.
 *
 * See https://github.com/mochajs/mocha/issues/764
 */
function withMocha(callback) {
    if ('beforeEach' in global) {
        callback();
        return;
    }
    setImmediate(function () {
        withMocha(callback);
    });
}
exports.withMocha = withMocha;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jaGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi90ZXN0L2hlbHBlcnMvbW9jaGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7OztHQUlHO0FBQ0gsbUJBQTBCLFFBQW1CO0lBQzNDLElBQUksWUFBWSxJQUFJLE1BQU0sRUFBRTtRQUMxQixRQUFRLEVBQUUsQ0FBQztRQUNYLE9BQU87S0FDUjtJQUVELFlBQVksQ0FBQztRQUNYLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFURCw4QkFTQyJ9