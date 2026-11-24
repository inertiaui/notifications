<?php

namespace InertiaUI\Notifications\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use InertiaUI\Notifications\Inbox;

/**
 * The request that changes or deletes the given notifications, such as the ones the user selected.
 */
class BatchNotificationsRequest extends FormRequest
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
        return [
            'action' => ['required', Rule::in(Inbox::batchActions())],
            'ids' => ['required', 'array', 'max:100'],
            'ids.*' => ['uuid'],
            'until' => ['exclude_unless:action,snooze', 'required', 'date', 'after:now'],
        ];
    }

    /**
     * Get the action that runs on the notifications.
     *
     * @return 'read'|'unread'|'seen'|'archive'|'unarchive'|'snooze'|'unsnooze'|'delete'
     */
    public function action(): string
    {
        return $this->validated('action');
    }

    /**
     * Get the IDs of the notifications and announcements that the action runs on.
     *
     * @return list<string>
     */
    public function ids(): array
    {
        return array_values($this->validated('ids'));
    }

    /**
     * Get the time that the notifications are snoozed until, for the snooze action.
     */
    public function until(): ?Carbon
    {
        $until = $this->validated('until');

        return $until === null ? null : Carbon::parse($until);
    }
}
