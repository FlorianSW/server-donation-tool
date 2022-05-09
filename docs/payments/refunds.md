# Refunds

Completed payments may be refunded by the payment provider (either by an action of the payment receiver/payment account owner, or by a technical reason).
The donation tool, once it gets the notification about a donation being refunded, will try to refund the perks assigned to the donator automatically.

However, refunding needs to be supported by the perk and might be done on a best-guess basis, depending on if the perk can identify that a specific allowed advantage was setup as a result of this donation.
For example, the priority queue perk can, with a pretty good confidence, evaluate if a priority queue for a specific user was created by a specific donation or not.
Only, if the donation which setup the priority queue, is also the one which is refunded, the donation tool will remove the priority queue.
Otherwise, the priority queue slot will be kept untouched.
This might be the case when the donator donated a second time some days after the first time, and when the first donation got refunded by the payment provider.

On the other hand, the discord role perk is not able to evaluate if a role of a user was setup by a specific donation.
In this case, the role will be removed from the user when any donation (which contains the discord role perk) gets refunded.
The donator may, in this case, open the still valid donation in their donation history and redeem the perks again in order to gain the role again.

> Note that refunds are currently _only_ supported by the payment Provider **PayPal**
