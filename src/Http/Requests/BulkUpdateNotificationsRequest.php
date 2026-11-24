<?php

namespace InertiaUI\Notifications\Http\Requests;

use Carbon\CarbonInterface;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

/**
 * The request that marks the signed-in user's notifications as seen or read, or archives them.
 *
 * Without `before`, the update covers every notification created until now. With `before` and `ids`, it
 * covers those created before that time, and those created at that time whose IDs are listed. A
 * `category` limits the update to the notifications of that category.
 */
class BulkUpdateNotificationsRequest extends FormRequest
{
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
        // The browser only lists the notifications created at the `before` time, which are few, so we
        // will allow far more IDs than a batch takes, while still bounding the query they end up in.
        return [
            'before' => ['nullable', 'date'],
            'ids' => ['nullable', 'array', 'max:1000'],
            'ids.*' => ['uuid'],
            'category' => ['nullable', 'string'],
            'read' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Get the time that the update covers the notifications created until.
     */
    public function before(): CarbonInterface
    {
        $before = $this->validated('before');

        if ($before === null) {
            return now();
        }

        return Carbon::parse($before);
    }

    /**
     * Get the IDs of the notifications created at the `before` time that the update covers.
     *
     * The IDs only count together with the `before` time. Without them, the update covers every
     * notification created until that time.
     *
     * @return list<string>|null
     */
    public function ids(): ?array
    {
        if ($this->validated('before') === null) {
            return null;
        }

        $ids = $this->validated('ids');

        if ($ids === null) {
            return null;
        }

        return array_values($ids);
    }

    /**
     * Get the category that the update is limited to.
     */
    public function category(): ?string
    {
        return $this->validated('category');
    }

    /**
     * Determine if only the notifications that have been read are archived.
     */
    public function onlyRead(): bool
    {
        return $this->boolean('read');
    }
}
