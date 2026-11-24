<?php

namespace InertiaUI\Notifications\WebPush;

use InvalidArgumentException;
use OpenSSLAsymmetricKey;
use RuntimeException;

/**
 * A key pair on the P-256 curve, as Web Push uses for the VAPID keys of the application and for the key
 * that encrypts each message. The public key is the 65-byte uncompressed point, and the private key is
 * the 32-byte scalar.
 */
class KeyPair
{
    /**
     * The name that OpenSSL gives the P-256 curve, on which Web Push keys lie.
     */
    protected const string CURVE = 'prime256v1';

    /**
     * Create a new key pair instance.
     *
     * @param  string  $publicKey  The uncompressed point, 65 bytes that start with 0x04.
     * @param  string  $privateKey  The private scalar, 32 bytes.
     *
     * @throws InvalidArgumentException
     */
    public function __construct(
        public readonly string $publicKey,
        public readonly string $privateKey,
    ) {
        self::ensurePublicKey($publicKey);

        $length = strlen($privateKey);

        if ($length !== 32) {
            throw new InvalidArgumentException("The private key must be 32 bytes, [{$length}] given.");
        }
    }

    /**
     * Generate a new key pair.
     *
     * @throws RuntimeException
     */
    public static function generate(): self
    {
        $key = openssl_pkey_new(['curve_name' => self::CURVE, 'private_key_type' => OPENSSL_KEYTYPE_EC]);

        if ($key === false) {
            throw new RuntimeException('OpenSSL could not generate a P-256 key pair.');
        }

        $details = openssl_pkey_get_details($key);

        if ($details === false || ! isset($details['ec']['x'], $details['ec']['y'], $details['ec']['d'])) {
            throw new RuntimeException('OpenSSL could not read the generated P-256 key pair.');
        }

        // OpenSSL leaves out the leading zero bytes of the coordinates and the scalar, so we will pad
        // them back to their full length, as the uncompressed point and the private key need them.
        return new self(
            "\x04".self::padded($details['ec']['x']).self::padded($details['ec']['y']),
            self::padded($details['ec']['d']),
        );
    }

    /**
     * Create a key pair from its URL-safe base64 keys, such as the VAPID keys of the config.
     *
     * @throws InvalidArgumentException
     */
    public static function fromBase64Url(string $publicKey, string $privateKey): self
    {
        return new self(Base64Url::decode($publicKey), Base64Url::decode($privateKey));
    }

    /**
     * Get the public key as URL-safe base64, as browsers receive the VAPID key.
     */
    public function publicKeyAsBase64Url(): string
    {
        return Base64Url::encode($this->publicKey);
    }

    /**
     * Get the private key as URL-safe base64.
     */
    public function privateKeyAsBase64Url(): string
    {
        return Base64Url::encode($this->privateKey);
    }

    /**
     * Determine if the public key is the one that the private key derives, so the two keys form one pair.
     *
     * @throws RuntimeException
     */
    public function belongTogether(): bool
    {
        return $this->derivedPublicKey() === $this->publicKey;
    }

    /**
     * Get the secret that this key pair shares with the owner of the given public key.
     *
     * @throws RuntimeException
     */
    public function sharedSecret(string $publicKey): string
    {
        $secret = openssl_pkey_derive(self::openSslPublicKey($publicKey), $this->openSslPrivateKey(), 32);

        if ($secret === false) {
            throw new RuntimeException('OpenSSL could not derive the shared secret.');
        }

        return $secret;
    }

    /**
     * Get the private key as an OpenSSL key, to sign with it.
     *
     * @throws RuntimeException
     */
    public function openSslPrivateKey(): OpenSSLAsymmetricKey
    {
        $key = openssl_pkey_new(['ec' => ['curve_name' => self::CURVE, 'd' => $this->privateKey]]);

        if ($key === false) {
            throw new RuntimeException('OpenSSL could not read the private key.');
        }

        // PHP quietly generates a new key when the scalar is no valid P-256 key, such as zero,
        // so we will make sure the key it returns holds the scalar of this key pair, instead
        // of signing with a random key that the push services would reject.
        if (self::padded(openssl_pkey_get_details($key)['ec']['d'] ?? '') !== $this->privateKey) {
            throw new RuntimeException('The private key must be a valid scalar of the P-256 curve.');
        }

        return $key;
    }

    /**
     * Get the uncompressed point that OpenSSL derives from the private scalar.
     *
     * @throws RuntimeException
     */
    protected function derivedPublicKey(): string
    {
        $details = openssl_pkey_get_details($this->openSslPrivateKey());

        if ($details === false || ! isset($details['ec']['x'], $details['ec']['y'])) {
            throw new RuntimeException('OpenSSL could not derive the public key of the private key.');
        }

        return "\x04".self::padded($details['ec']['x']).self::padded($details['ec']['y']);
    }

    /**
     * Get the given public key as an OpenSSL key.
     *
     * @throws InvalidArgumentException
     */
    public static function openSslPublicKey(string $publicKey): OpenSSLAsymmetricKey
    {
        self::ensurePublicKey($publicKey);

        $key = openssl_pkey_new(['ec' => [
            'curve_name' => self::CURVE,
            'x' => substr($publicKey, 1, 32),
            'y' => substr($publicKey, 33, 32),
        ]]);

        if ($key === false) {
            throw new InvalidArgumentException('The public key must be a point on the P-256 curve.');
        }

        return $key;
    }

    /**
     * Ensure the given value is an uncompressed point.
     *
     * @throws InvalidArgumentException
     */
    protected static function ensurePublicKey(string $publicKey): void
    {
        $length = strlen($publicKey);

        if ($length !== 65) {
            throw new InvalidArgumentException(
                "The public key must be an uncompressed point of 65 bytes, [{$length}] bytes given.",
            );
        }

        if ($publicKey[0] !== "\x04") {
            $prefix = bin2hex($publicKey[0]);

            throw new InvalidArgumentException(
                "The public key must be an uncompressed point that starts with 0x04, [0x{$prefix}] given.",
            );
        }
    }

    /**
     * Get the given bytes, padded with leading zero bytes to 32 bytes.
     */
    protected static function padded(string $bytes): string
    {
        return str_pad($bytes, 32, "\0", STR_PAD_LEFT);
    }
}
