<?php

namespace InertiaUI\Notifications;

use Illuminate\Database\Eloquent\Model;
use Inertia\ProvidesInertiaProperties;
use Inertia\RenderContext;

/**
 * The props of a page with every notification of the signed-in user, which renders `<NotificationList>`.
 *
 * Pass it to `Inertia::render()` on its own or with the page's other props, such as
 * `Inertia::render('Notifications', [Inbox::page(), 'team' => $team])`.
 */
class InboxPage implements ProvidesInertiaProperties
{
    /**
     * Create a new inbox page instance.
     *
     * @param  int|null  $perPage  The number of notifications on each page, in place of the `inbox.per_page` config.
     */
    public function __construct(public readonly ?int $perPage = null) {}

    /**
     * Get the `filter` and `category` query parameters, which the list's tabs and category buttons link to, and the
     * `notifications` that match them, as an Inertia scroll prop.
     *
     * A filter that the list does not offer lists every notification, as `Inbox::resolveFilter()` decides.
     *
     * @return array<string, mixed>
     */
    public function toInertiaProperties(RenderContext $context): iterable
    {
        $request = $context->request;
        $user = $request->user();

        // The notification center stores notifications by the morph class and key of a model, so a signed-in
        // user that is not an Eloquent model is refused, like the notification center's own routes do.
        abort_unless($user instanceof Model, 403);

        $filter = Inbox::resolveFilter($request->query('filter'));
        $category = is_string($request->query('category')) ? $request->query('category') : null;

        return [
            'filter' => $filter,
            'category' => $category,
            'notifications' => Inbox::scroll($user, $filter, $category, $this->perPage),
        ];
    }
}
