import { differenceInDays } from "date-fns";

export function hasRoleCount(member, count) {
    return member.roles.length == count;
}

export function joinedDaysAgo(member) {
    var joined = new Date(member.joined_at);
    var now = new Date();

    return differenceInDays(now, joined);
}