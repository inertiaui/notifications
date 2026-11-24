<?php

namespace InertiaUI\Notifications\WebPush;

use Carbon\CarbonInterface;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

/**
 * Identifies the application to push services with VAPID (RFC 8292): a JSON Web Token signed with the
 * application's key pair, which a push service checks against the key the subscription was made with.
 */
class Vapid
{
    /**
     * The domains of examples and of the local machine, which Apple refuses in the subject.
     *
     * @var list<string>
     */
    protected const array PLACEHOLDER_DOMAINS = ['localhost', 'example.com', 'example.net', 'example.org'];

    /**
     * The warning of the commands about a subject on a placeholder domain, which Apple refuses.
     */
    public const string PLACEHOLDER_DOMAIN_WARNING = 'Apple refuses the pushes of a subject on localhost or '
        .'example.com, with a 403 BadJwtToken. Set VAPID_SUBJECT to an address on a domain you own, such as '
        .'[mailto:support@your-app.com].';

    /**
     * Create a new VAPID instance.
     *
     * @param  KeyPair  $keys  The VAPID key pair of the application.
     * @param  string  $subject  A `mailto:` or `https:` URL where the push service may contact the application.
     */
    public function __construct(
        public readonly KeyPair $keys,
        public readonly string $subject,
    ) {}

    /**
     * Determine if the given subject is a `mailto:` or `https:` URL, as push services require.
     */
    public static function acceptsSubject(string $subject): bool
    {
        return Str::startsWith($subject, ['mailto:', 'https://']);
    }

    /**
     * Determine if the given subject is a `mailto:` URL of a valid email address, or a valid `https:` URL.
     *
     * The configuration is only checked for the scheme, since every page fails on a subject that it refuses.
     * The commands check the address or URL itself, since a typo only shows once push services refuse it.
     */
    public static function isWellFormedSubject(string $subject): bool
    {
        if (! self::acceptsSubject($subject)) {
            return false;
        }

        if (Str::startsWith($subject, 'mailto:')) {
            return filter_var(Str::after($subject, 'mailto:'), FILTER_VALIDATE_EMAIL) !== false;
        }

        return filter_var($subject, FILTER_VALIDATE_URL) !== false;
    }

    /**
     * Determine if the given subject is on localhost or an example domain, such as example.com.
     */
    public static function hasPlaceholderDomain(string $subject): bool
    {
        $domain = self::domainOf($subject);

        foreach (self::PLACEHOLDER_DOMAINS as $placeholder) {
            if ($domain === $placeholder || str_ends_with($domain, ".{$placeholder}")) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the lowercase domain of the given subject: the domain of its email address, or the host of its URL.
     */
    protected static function domainOf(string $subject): string
    {
        if (! Str::startsWith($subject, 'mailto:')) {
            return strtolower((string) parse_url($subject, PHP_URL_HOST));
        }

        // An address without an @ has no domain, so we will not take the whole subject for one, as
        // Str::afterLast() would return it when it does not find the @.
        if (! Str::contains($subject, '@')) {
            return '';
        }

        return strtolower(Str::afterLast($subject, '@'));
    }

    /**
     * Get the `Authorization` header of a push message to the given endpoint.
     *
     * @throws InvalidArgumentException
     * @throws RuntimeException
     */
    public function authorization(string $endpoint, CarbonInterface $expiresAt): string
    {
        $token = $this->token($this->audience($endpoint), $expiresAt);

        return "vapid t={$token}, k={$this->keys->publicKeyAsBase64Url()}";
    }

    /**
     * Get the signed token for the given audience.
     *
     * @throws RuntimeException
     */
    protected function token(string $audience, CarbonInterface $expiresAt): string
    {
        $header = Base64Url::encode((string) json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $claims = Base64Url::encode((string) json_encode([
            'aud' => $audience,
            'exp' => $expiresAt->getTimestamp(),
            'sub' => $this->subject,
        ], JSON_UNESCAPED_SLASHES));

        $input = "{$header}.{$claims}";

        if (! openssl_sign($input, $signature, $this->keys->openSslPrivateKey(), OPENSSL_ALGO_SHA256)) {
            throw new RuntimeException('OpenSSL could not sign the VAPID token.');
        }

        return $input.'.'.Base64Url::encode(self::rawSignature($signature));
    }

    /**
     * Get the origin of the given endpoint, which is the audience of its token.
     *
     * @throws InvalidArgumentException
     */
    protected function audience(string $endpoint): string
    {
        $parts = parse_url($endpoint);

        if (! is_array($parts) || ($parts['scheme'] ?? null) !== 'https' || ! isset($parts['host'])) {
            throw new InvalidArgumentException("The push endpoint [{$endpoint}] must be an https:// URL.");
        }

        $port = isset($parts['port']) ? ":{$parts['port']}" : '';

        return "https://{$parts['host']}{$port}";
    }

    /**
     * Get the given DER signature as the two 32-byte integers that a JSON Web Token holds.
     *
     * OpenSSL signs in DER: a sequence of two integers, each with a leading zero byte when its first
     * bit is set, and without the leading zero bytes of a shorter value. ES256 needs both at 32 bytes.
     *
     * @throws RuntimeException
     */
    public static function rawSignature(string $der): string
    {
        $offset = 2;
        $integers = [];

        while (count($integers) < 2) {
            if (($der[$offset] ?? null) !== "\x02") {
                throw new RuntimeException('The signature is not a DER sequence of two integers.');
            }

            $length = ord($der[$offset + 1]);
            $integers[] = str_pad(ltrim(substr($der, $offset + 2, $length), "\0"), 32, "\0", STR_PAD_LEFT);
            $offset += 2 + $length;
        }

        return $integers[0].$integers[1];
    }
}
