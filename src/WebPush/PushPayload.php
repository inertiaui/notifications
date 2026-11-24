<?php

namespace InertiaUI\Notifications\WebPush;

use Illuminate\Support\Arr;
use LengthException;

/**
 * The notification that a push shows, in the Declarative Web Push format. Safari 18.4 and later show such a push
 * without JavaScript, and other browsers hand it to the service worker, which shows the same notification.
 */
class PushPayload
{
    /**
     * The magic number of the Declarative Web Push format, which tells the browser that it may show the push.
     */
    protected const int DECLARATIVE_WEB_PUSH = 8030;

    /**
     * Create a new push payload instance.
     *
     * @param  string  $id  The ID of the notification, which the service worker receives under `data.id`.
     * @param  string  $navigate  The absolute URL that a click on the notification opens.
     * @param  string  $tag  The tag of the notification, which replaces an earlier notification with the same tag.
     * @param  string|null  $icon  The absolute URL of the image that the notification shows.
     * @param  string|null  $lang  The language of the title and body, as a BCP 47 tag.
     * @param  int|null  $timestamp  The time of the notification, in milliseconds since the Unix epoch.
     * @param  string|null  $context  The opaque key of the notification's context, under `data.context`, so a
     *                                bulk change closes only the pushes of its context, or null for a notification
     *                                without one.
     */
    public function __construct(
        public readonly string $id,
        public readonly string $title,
        public readonly ?string $body,
        public readonly string $navigate,
        public readonly string $tag,
        public readonly ?string $icon = null,
        public readonly ?string $lang = null,
        public readonly ?int $timestamp = null,
        public readonly ?string $context = null,
    ) {}

    /**
     * Get the payload as JSON that fits in one push message.
     *
     * The body is shortened first, and the title only once the body is gone, until the JSON fits within
     * the bytes that every push service accepts.
     *
     * @throws LengthException
     */
    public function toJson(): string
    {
        $title = $this->title;
        $body = $this->body;
        $json = $this->encode($title, $body);

        while (strlen($json) > PayloadEncrypter::MAX_PAYLOAD_LENGTH) {
            $overflow = strlen($json) - PayloadEncrypter::MAX_PAYLOAD_LENGTH;

            if ($body !== null) {
                $body = self::shorten($body, $overflow);
            } elseif ($title !== '') {
                $title = (string) self::shorten($title, $overflow);
            } else {
                throw new LengthException("The push of notification [{$this->id}] does not fit without its title.");
            }

            $json = $this->encode($title, $body);
        }

        return $json;
    }

    /**
     * Get the topic of the push, which replaces an undelivered push of the same notification at the push service.
     */
    public function topic(): string
    {
        return Base64Url::encode(md5($this->id, true));
    }

    /**
     * Encode the payload with the given title and body.
     */
    protected function encode(string $title, ?string $body): string
    {
        $notification = Arr::whereNotNull([
            'title' => $title,
            'body' => $body,
            'navigate' => $this->navigate,
            'tag' => $this->tag,
            'icon' => $this->icon,
            'silent' => false,
            'lang' => $this->lang,
            'dir' => 'auto',
            'timestamp' => $this->timestamp,
            'data' => Arr::whereNotNull(['id' => $this->id, 'context' => $this->context]),
        ]);

        return (string) json_encode([
            'web_push' => self::DECLARATIVE_WEB_PUSH,
            'notification' => $notification,
            'mutable' => true,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    }

    /**
     * Shorten the given text by at least the given number of bytes, ending it with an ellipsis.
     *
     * Returns null once nothing of the text is left.
     */
    protected static function shorten(string $text, int $bytes): ?string
    {
        // We will cut at a character boundary, so the text stays valid UTF-8, and leave room for the
        // three bytes of the ellipsis, so the shortened text is at least the given bytes shorter.
        $kept = rtrim(mb_strcut($text, 0, max(0, strlen($text) - $bytes - 3), 'UTF-8'));

        return $kept === '' ? null : "{$kept}…";
    }
}
