<?php

namespace InertiaUI\Notifications\WebPush;

use InvalidArgumentException;
use RuntimeException;

/**
 * Encrypts the payload of a push message for one subscription with the `aes128gcm` content coding of
 * RFC 8291, as every push service requires. Each message gets its own key pair and salt.
 */
class PayloadEncrypter
{
    /**
     * The record size of the content coding header, which a single record of a push message stays under.
     */
    protected const int RECORD_SIZE = 4096;

    /**
     * The longest payload that every push service accepts, which is 4096 bytes without the header, the
     * padding delimiter, and the authentication tag.
     */
    public const int MAX_PAYLOAD_LENGTH = 3993;

    /**
     * Create a new payload encrypter instance.
     *
     * @param  KeyPair  $keys  The key pair of the application server for this message.
     * @param  string  $salt  The salt of this message, 16 random bytes.
     *
     * @throws InvalidArgumentException
     */
    public function __construct(
        public readonly KeyPair $keys,
        public readonly string $salt,
    ) {
        $length = strlen($salt);

        if ($length !== 16) {
            throw new InvalidArgumentException("The salt must be 16 bytes, [{$length}] given.");
        }
    }

    /**
     * Create a payload encrypter with a new key pair and salt.
     */
    public static function make(): self
    {
        return new self(KeyPair::generate(), random_bytes(16));
    }

    /**
     * Encrypt the given payload for the subscription with the given public key and authentication secret.
     *
     * @param  string  $publicKey  The `p256dh` key of the subscription, as the 65-byte uncompressed point.
     * @param  string  $authSecret  The `auth` secret of the subscription, 16 bytes.
     *
     * @throws InvalidArgumentException
     * @throws RuntimeException
     */
    public function encrypt(string $payload, string $publicKey, string $authSecret): string
    {
        $length = strlen($payload);

        if ($length > self::MAX_PAYLOAD_LENGTH) {
            $maximum = self::MAX_PAYLOAD_LENGTH;

            throw new InvalidArgumentException("The push payload must be at most {$maximum} bytes, [{$length}] given.");
        }

        $inputKey = $this->inputKey($publicKey, $authSecret);
        $contentKey = hash_hkdf('sha256', $inputKey, 16, "Content-Encoding: aes128gcm\0", $this->salt);
        $nonce = hash_hkdf('sha256', $inputKey, 12, "Content-Encoding: nonce\0", $this->salt);

        // A push message is a single record, so the padding delimiter of the last record ends the
        // payload, and the nonce needs no record sequence number, as the first record has none.
        $ciphertext = openssl_encrypt($payload."\x02", 'aes-128-gcm', $contentKey, OPENSSL_RAW_DATA, $nonce, $tag);

        if ($ciphertext === false) {
            throw new RuntimeException('OpenSSL could not encrypt the push payload.');
        }

        return $this->header().$ciphertext.$tag;
    }

    /**
     * Get the input keying material, which combines the shared secret with the authentication secret.
     *
     * @throws InvalidArgumentException
     */
    protected function inputKey(string $publicKey, string $authSecret): string
    {
        $length = strlen($authSecret);

        if ($length !== 16) {
            throw new InvalidArgumentException("The auth secret must be 16 bytes, [{$length}] given.");
        }

        $info = "WebPush: info\0{$publicKey}{$this->keys->publicKey}";

        return hash_hkdf('sha256', $this->keys->sharedSecret($publicKey), 32, $info, $authSecret);
    }

    /**
     * Get the header of the content coding: the salt, the record size, and the public key of the message.
     */
    protected function header(): string
    {
        return $this->salt.pack('N', self::RECORD_SIZE).chr(strlen($this->keys->publicKey)).$this->keys->publicKey;
    }
}
