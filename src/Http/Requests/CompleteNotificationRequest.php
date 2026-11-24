<?php

namespace InertiaUI\Notifications\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The request that completes one of the signed-in user's notifications with the result of an action.
 */
class CompleteNotificationRequest extends FormRequest
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
            'action' => ['required', 'integer', 'min:0'],
        ];
    }

    /**
     * Get the index of the action that the user ran.
     */
    public function actionIndex(): int
    {
        return (int) $this->validated('action');
    }
}
