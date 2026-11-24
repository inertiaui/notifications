<?php

namespace InertiaUI\Notifications\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use InertiaUI\Notifications\Inbox;
use InertiaUI\Notifications\Push;
use InertiaUI\Notifications\WebPush\Base64Url;
use InertiaUI\Notifications\WebPush\KeyPair;
use InvalidArgumentException;

/**
 * The request that stores the push subscription of the current browser for the signed-in user. The browser
 * posts what `PushSubscription.toJSON()` returns, with the content encoding that it encrypts with.
 */
class SubscribePushRequest extends FormRequest
{
    /**
     * The longest endpoint that is stored.
     */
    public const int MAX_ENDPOINT_LENGTH = 2048;

    /**
     * The latest expiration time that is stored, in milliseconds, which is the end of 9999-12-30 in UTC.
     * The time is stored in the application's timezone, so it still fits 9999-12-31, the last day that a
     * datetime column holds, up to 14 hours east of UTC.
     */
    protected const int MAX_EXPIRATION_TIME = 253402214399999;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'endpoint' => ['required', 'string', 'max:'.self::MAX_ENDPOINT_LENGTH, $this->validateEndpoint(...)],
            'expirationTime' => ['nullable', 'integer', 'min:0', 'max:'.self::MAX_EXPIRATION_TIME],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string', $this->validatePublicKey(...)],
            'keys.auth' => ['required', 'string', $this->validateAuthSecret(...)],
            'refresh' => ['boolean'],
        ];
    }

    /**
     * Determine if the page only saves the subscription of a device that the user still has, as its own check does.
     */
    public function refresh(): bool
    {
        return $this->boolean('refresh');
    }

    /**
     * Get the attributes of the subscription to store.
     *
     * The keys are stored as URL-safe base64 without padding, since they pass the validation also with
     * whitespace, padding, or the characters of standard base64, which would make them longer.
     *
     * @return array{
     *     endpoint: string,
     *     p256dh: string,
     *     auth: string,
     *     expires_at: Carbon|null,
     *     user_agent: string|null,
     * }
     */
    public function subscription(): array
    {
        $expirationTime = $this->validated('expirationTime');
        $userAgent = $this->userAgent();

        return [
            'endpoint' => (string) $this->validated('endpoint'),
            'p256dh' => Base64Url::encode(Base64Url::decode((string) $this->validated('keys.p256dh'))),
            'auth' => Base64Url::encode(Base64Url::decode((string) $this->validated('keys.auth'))),
            'expires_at' => $expirationTime === null
                ? null
                : Inbox::inApplicationTimezone(Carbon::createFromTimestampMs((int) $expirationTime)),
            'user_agent' => $userAgent === null ? null : Str::limit($userAgent, 1000, ''),
        ];
    }

    /**
     * Validate that the endpoint is an https:// URL of a push service in the `push.hosts` config.
     */
    protected function validateEndpoint(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || Push::allowsEndpoint($value)) {
            return;
        }

        $host = parse_url($value, PHP_URL_HOST);

        if (! is_string($host) || ! str_starts_with($value, 'https://')) {
            $fail('The :attribute must be an https:// URL.');

            return;
        }

        $fail("The push service [{$host}] is not in the [inertia-notifications.push.hosts] config.");
    }

    /**
     * Validate that the `p256dh` key is a point on the P-256 curve, as URL-safe base64.
     */
    protected function validatePublicKey(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        try {
            KeyPair::openSslPublicKey(Base64Url::decode($value));
        } catch (InvalidArgumentException) {
            $fail('The :attribute key must be a P-256 public key of 65 bytes, as URL-safe base64.');
        }
    }

    /**
     * Validate that the `auth` secret is 16 bytes, as URL-safe base64.
     */
    protected function validateAuthSecret(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        try {
            $secret = Base64Url::decode($value);
        } catch (InvalidArgumentException) {
            $secret = '';
        }

        if (strlen($secret) !== 16) {
            $fail('The :attribute secret must be 16 bytes, as URL-safe base64.');
        }
    }
}
